"""Optional environment check: requires Python Playwright and system Chromium, not app dependencies."""
import json
import os
from pathlib import Path
import secrets
import subprocess
import tempfile
import time
import urllib.request
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]


def wait_for_gateway():
    """Wait for a functional gateway read, rather than only an open port."""
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
    for attempt in range(80):
        try:
            with opener.open('http://127.0.0.1:3000/products', timeout=1) as response:
                if response.status == 200:
                    return
        except OSError:
            time.sleep(0.05)
    raise RuntimeError('Gateway did not become ready')


def run():
    """Exercise both CRUD forms in a real browser with disposable data and credentials."""
    processes = []
    with tempfile.TemporaryDirectory(prefix='inventory-browser-') as temporary:
        for name in ['products', 'stock']:
            (Path(temporary) / f'{name}.json').write_text('[]\n')
        admin = secrets.token_hex(24)
        environment = {**os.environ, 'DATA_DIR': temporary,
                       'ADMIN_KEY': admin, 'GATEWAY_SECRET': secrets.token_hex(24)}
        try:
            for name in ['products', 'stock', 'gateway']:
                processes.append(subprocess.Popen(['npm', 'run', name], cwd=ROOT,
                    env=environment, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                    start_new_session=True))
            wait_for_gateway()
            with sync_playwright() as playwright:
                browser = playwright.chromium.launch(executable_path='/usr/bin/chromium',
                    headless=True, args=['--no-sandbox'])
                page = browser.new_page()
                page.goto('http://127.0.0.1:3000/')
                page.wait_for_function("() => document.querySelector('#message').textContent === 'Inventory loaded.'")
                page.locator('#product-name').fill('Unauthorized')
                page.locator('#product-price').fill('1')
                page.get_by_role('button', name='Save product', exact=True).click()
                page.wait_for_function("() => document.querySelector('#message').textContent.includes('401')")
                page.locator('#admin-key').fill(admin)
                page.locator('#product-name').fill('<img src=x onerror=alert(1)>')
                page.locator('#product-price').fill('0')
                page.get_by_role('button', name='Save product', exact=True).click()
                page.wait_for_function("() => document.querySelector('#message').textContent === 'Saved products record 1.'")
                assert page.locator('#products img').count() == 0
                assert '<img src=x onerror=alert(1)>' in page.locator('#products').inner_text()
                page.get_by_role('button', name='Edit products record 1', exact=True).click()
                page.locator('#product-name').fill('Updated notebook')
                page.locator('#product-price').fill('2.5')
                page.get_by_role('button', name='Save product', exact=True).click()
                page.wait_for_function("() => document.querySelector('#products').textContent.includes('Updated notebook')")
                page.locator('#stock-product').fill('1')
                page.locator('#stock-quantity').fill('0')
                page.get_by_role('button', name='Save stock', exact=True).click()
                page.wait_for_function("() => document.querySelector('#message').textContent === 'Saved stock record 1.'")
                page.get_by_role('button', name='Edit stock record 1', exact=True).click()
                page.locator('#stock-quantity').fill('5')
                page.get_by_role('button', name='Save stock', exact=True).click()
                page.wait_for_function("() => document.querySelector('#stock tr td:nth-child(3)').textContent === '5'")
                page.once('dialog', lambda dialog: dialog.accept())
                page.get_by_role('button', name='Delete products record 1', exact=True).click()
                page.wait_for_function("() => document.querySelector('#products').textContent.includes('No records yet.')")
                assert page.locator('#stock tr').count() == 1
                page.once('dialog', lambda dialog: dialog.accept())
                page.get_by_role('button', name='Delete stock record 1', exact=True).click()
                page.wait_for_function("() => document.querySelector('#stock').textContent.includes('No records yet.')")
                page.get_by_role('button', name='Clear key', exact=True).click()
                assert page.locator('#admin-key').input_value() == ''
                page.set_viewport_size({'width': 390, 'height': 844})
                assert page.evaluate('document.documentElement.scrollWidth <= window.innerWidth')
                browser.close()
            print('PASS: browser product/stock CRUD, 401 feedback, safe text rendering, key clearing, mobile width')
        finally:
            # npm starts child Node processes: terminate the process groups owned by this script.
            import signal
            for process in processes:
                if process.poll() is None:
                    os.killpg(process.pid, signal.SIGTERM)
            for process in processes:
                process.wait(timeout=5)


if __name__ == '__main__':
    run()
