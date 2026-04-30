# Mobile-First Design Review (Current Run)

## What Improved
- Added mobile bottom tab navigation for trainer and client shells to reduce thumb-travel.
- Reduced container and panel padding on small screens for denser usable content.
- Added active navigation state to improve orientation across routes.
- Wired schedule screen to live event data and status actions so UI is not static.
- Kept primary actions high-contrast mint and preserved consistent component rhythm.

## Current UX Risks
- Some forms still include long textareas without step-wise progression for small screens.
- Session detail has many actions in one screen; could benefit from segmented tabs (Summary / Notes / Comments).
- Login OTP and trainer auth are functional, but success/error states can be more explicit and less text-heavy.
- Client and trainer palettes are currently identical; role separation can be improved with subtle token differences.

## Next Improvements (Priority)
1. Convert long forms (`sessions/new`, self-log) into stepper cards with sticky primary action.
2. Add reusable toast/snackbar feedback component instead of inline status text.
3. Add route guard/redirect UX for unauthenticated states to avoid dead-end navigation.
4. Improve list actions with icon-first compact buttons for one-hand usage.
5. Add client/trainer role badges and clearer headers to reduce context switching.

## Functional Design Principle Going Forward
- Every major screen should be fully usable with one thumb on 390px width:
  - primary action visible,
  - no horizontal overflow,
  - no critical action hidden below non-essential content.
