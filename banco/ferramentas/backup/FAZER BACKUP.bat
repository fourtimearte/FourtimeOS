@echo off
rem Backup do banco do Fourtime OS para o Google Drive. Dois cliques e pronto.
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0fazer-backup.ps1"
