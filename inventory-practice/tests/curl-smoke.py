"""Actual POSIX cURL checks; the separate PowerShell guide remains a manual exercise."""
import json
import os
from pathlib import Path
import secrets
import signal
import subprocess
import tempfile
import time

ROOT = Path(__file__).resolve().parents[1]


def stop(process):
    """Stop a child process group owned by this script."""
    if process.poll() is None:
        os.killpg(process.pid, signal.SIGTERM)
    process.wait(timeout=5)


def run():
    """Exercise both resources through actual cURL requests against disposable data."""
    children = []
    count = 0
    with tempfile.TemporaryDirectory(prefix='inventory-curl-') as directory:
        for resource in ['products', 'stock']:
            (Path(directory) / f'{resource}.json').write_text('[]\n')
        admin = secrets.token_hex(24)
        environment = {**os.environ, 'DATA_DIR': directory,
            'ADMIN_KEY': admin, 'GATEWAY_SECRET': secrets.token_hex(24), 'GATEWAY_TIMEOUT_MS': '150'}

        def start(script):
            """Start one test-owned service without exposing test credentials."""
            process = subprocess.Popen(['node', script], cwd=ROOT, env=environment,
                stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, start_new_session=True)
            children.append(process)
            return process

        def check(route, status, method='GET', body=None, port=3000, authenticated=True):
            """Execute cURL without shell interpolation and assert its status and JSON body."""
            nonlocal count
            arguments = ['curl', '-sS', '--max-time', '4', '--noproxy', '127.0.0.1',
                '-w', '\n%{http_code}', '-X', method, f'http://127.0.0.1:{port}{route}']
            if method != 'GET' and authenticated:
                arguments += ['-H', 'Authorization: Bearer ' + admin]
            if body is not None:
                arguments += ['-H', 'Content-Type: application/json', '--data-binary', json.dumps(body)]
            result = subprocess.run(arguments, capture_output=True, text=True)
            if result.returncode != 0:
                raise RuntimeError('cURL transport failed: ' + result.stderr)
            text, actual = result.stdout.rsplit('\n', 1)
            assert int(actual) == status, f'{method} {route}: got {actual}, expected {status}'
            value = json.loads(text)
            if status >= 400:
                assert isinstance(value.get('error'), str)
            assert admin not in text and environment['GATEWAY_SECRET'] not in text
            count += 1
            return value

        try:
            products = start('services/products.js')
            start('services/stock.js')
            start('services/gateway.js')
            for attempt in range(80):
                result = subprocess.run(['curl', '-s', '--noproxy', '127.0.0.1', '--max-time', '1',
                    'http://127.0.0.1:3000/products'], capture_output=True, text=True)
                if result.returncode == 0 and result.stdout == '[]':
                    break
                time.sleep(0.05)
            else:
                raise RuntimeError('Gateway did not become ready')
            for resource, first, update, port in [
                ('products', {'name': 'Notebook', 'price': 3.5}, {'name': 'Free', 'price': 0}, 3001),
                ('stock', {'productId': 1, 'quantity': 10}, {'productId': 1, 'quantity': 0}, 3002)]:
                assert check('/'+resource, 200) == []
                assert check('/'+resource, 201, 'POST', first) == {'id': 1, **first}
                assert check('/'+resource+'/1', 200) == {'id': 1, **first}
                assert check('/'+resource+'/1', 200, 'PUT', update) == {'id': 1, **update}
                check('/'+resource, 400, 'POST', {})
                check('/'+resource, 401, 'POST', first, authenticated=False)
                check('/'+resource, 401, port=port)
                check('/'+resource+'/1', 200, 'DELETE')
                check('/'+resource+'/1', 404)
            check('/unknown', 404)
            stop(products)
            check('/products', 502)
            start('tests/slow-service.js')
            time.sleep(0.15)
            check('/products', 504)
            check('/stock', 200)
            print(f'PASS: {count} actual cURL requests; both resources CRUD, validation, access, 502 and 504')
        finally:
            for process in children:
                stop(process)


if __name__ == '__main__':
    run()
