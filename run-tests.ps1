Write-Host "[+] Running All Backend Unit & Property Tests..." -ForegroundColor Cyan
$env:TESTING = "1"
$env:LEDGER_DB_PATH = ":memory:"
cd backend
& "C:\Users\varun\AppData\Local\Programs\Python\Python313\python.exe" -m pytest -v
cd ..
