; Custom pages for the Tally Capture installer (electron-builder assisted NSIS).
; The sidebar art on the welcome and finish pages comes from build/installerSidebar.bmp.

!macro customHeader
  !define MUI_FINISHPAGE_TITLE "Tally Capture is ready"
  !define MUI_FINISHPAGE_TEXT "Open Tally Capture and choose Sign in with your browser to connect your workspace.$\r$\n$\r$\nFor real speaker names in Google Meet, add the Tally for Meet extension from Settings in Tally."
  !define MUI_FINISHPAGE_RUN_TEXT "Open Tally Capture now"
!macroend

!macro customWelcomePage
  !define MUI_WELCOMEPAGE_TITLE "Welcome to Tally Capture"
  !define MUI_WELCOMEPAGE_TEXT "Record your meetings without a bot joining the call.$\r$\n$\r$\nTally Capture records your microphone and your computer's audio as separate tracks, so your Tally transcript knows who said what. A few minutes after you stop, you get the recap, decisions and who owes what.$\r$\n$\r$\nNothing is recorded until you press Record.$\r$\n$\r$\nClick Next to continue."
  !insertmacro MUI_PAGE_WELCOME
!macroend

!macro customUnWelcomePage
  !define MUI_WELCOMEPAGE_TITLE "Uninstall Tally Capture"
  !define MUI_WELCOMEPAGE_TEXT "This removes Tally Capture from this computer. Meetings already uploaded stay in your Tally workspace.$\r$\n$\r$\nClick Next to continue."
  !insertmacro MUI_UNPAGE_WELCOME
!macroend
