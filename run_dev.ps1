# Bistro Moderne - PowerShell Dev Runner
Write-Host "===================================================" -ForegroundColor Cyan
Write-Host "   Starting Bistro Moderne Fullstack Services      " -ForegroundColor Yellow
Write-Host "===================================================" -ForegroundColor Cyan

$root = $PSScriptRoot

Write-Host "`n[1/2] Launching FastAPI Backend on http://localhost:8000..." -ForegroundColor Green
Start-Process -FilePath "powershell.exe" -ArgumentList "-NoExit", "-Command", "cd '$root\backend'; .\venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000"

Write-Host "[2/2] Launching Next.js 14 Frontend on http://localhost:3000..." -ForegroundColor Green
Start-Process -FilePath "powershell.exe" -ArgumentList "-NoExit", "-Command", "cd '$root\frontend'; npm run dev"

Write-Host "`nAll development services are starting up!" -ForegroundColor Cyan
Write-Host "  * Customer Menu & Home Delivery : http://localhost:3000" -ForegroundColor White
Write-Host "  * Kitchen Admin Dashboard       : http://localhost:3000/admin/login" -ForegroundColor White
Write-Host "  * FastAPI Interactive Swagger   : http://localhost:8000/docs" -ForegroundColor White
Write-Host "`nAdmin Credentials:" -ForegroundColor DarkGray
Write-Host "  Configured in backend/.env (ADMIN_EMAIL & ADMIN_PASSWORD)" -ForegroundColor DarkGray
