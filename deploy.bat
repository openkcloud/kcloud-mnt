@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo.
echo ====================================
echo  openKcloud CMP - Netlify 배포
echo ====================================
echo.

if not exist "out\index.html" (
  echo [오류] out 폴더가 없거나 빌드가 완료되지 않았습니다.
  echo.
  echo 먼저 빌드부터 진행합니다.
  echo.
  call npm run build
  if errorlevel 1 (
    echo.
    echo [오류] 빌드 실패. 위 에러 메시지를 확인하세요.
    pause
    exit /b 1
  )
)

echo.
echo out 폴더를 Netlify에 업로드합니다...
echo - 처음 실행 시 브라우저가 열려 GitHub/이메일 로그인 1회 필요
echo - 이후에는 자동 진행
echo.

call npx --yes netlify-cli deploy --dir=out --prod

echo.
echo ====================================
echo  완료. 위에 표시된 Website URL이 배포 주소입니다.
echo ====================================
echo.
pause
