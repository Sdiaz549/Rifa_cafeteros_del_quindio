!macro customInstall
  SetShellVarContext all
  CreateShortCut "$DESKTOP\Sistema de Rifas.lnk" "$INSTDIR\Sistema de Rifas.exe"
  CreateDirectory "$SMPROGRAMS"
  CreateShortCut "$SMPROGRAMS\Sistema de Rifas.lnk" "$INSTDIR\Sistema de Rifas.exe"

  ; Quitar la copia anterior (por usuario) para que no se abra un acceso que desaparece.
  RMDir /r "$LOCALAPPDATA\Programs\Sistema de Rifas"
  SetShellVarContext current
  Delete "$SMPROGRAMS\Sistema de Rifas.lnk"
  SetShellVarContext all
!macroend
