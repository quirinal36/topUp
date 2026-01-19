# Work Plan: POS-Style UI Transformation

**Created**: 2026-01-19
**Status**: Ready for Implementation
**Estimated Effort**: 3-4 days

---

## Context

### Original Request
Transform the café prepaid management system UI into a POS (Point of Sale) style optimized for tablet use during busy service hours.

### Interview Summary
| Question | Answer |
|----------|--------|
| Primary Device | Tablet (iPad/Galaxy Tab 10-12") |
| Core Workflow | Deduction (차감) - most frequent |
| Customer Lookup | Phone number last digits |
| Quick Amounts | Yes, configurable presets |
| Scope | Core only (Dashboard, Customers, Modals) |
| Visual Style | Modern minimal (Apple-style) |
| Feedback | Both visual and audio |

### Key Files (Pre-Gathered)
- `frontend/src/components/common/Button.tsx`
- `frontend/src/components/common/Input.tsx`
- `frontend/src/components/common/Modal.tsx`
- `frontend/src/components/customer/CustomerCard.tsx`
- `frontend/src/components/transaction/ChargeModal.tsx`
- `frontend/src/components/transaction/DeductModal.tsx`
- `frontend/src/pages/Dashboard.tsx`
- `frontend/src/pages/Customers.tsx`
- `frontend/tailwind.config.js`

---

## Work Objectives

### Core Objective
Create a tablet-optimized POS interface that enables café staff to complete customer transactions (especially deductions) in under 5 seconds during peak hours.

### Deliverables
1. **POS-optimized Button component** with `pos` size variant (60px+ height)
2. **Numpad component** for quick phone number search
3. **Quick amount selector** with configurable preset buttons
4. **POS Dashboard layout** with prominent deduction workflow
5. **Optimized CustomerCard** for touch selection
6. **Enhanced modals** with large touch targets
7. **Audio feedback system** for transaction confirmations
8. **Tablet-responsive layouts** (768px-1024px breakpoint focus)

### Definition of Done
- [ ] All touch targets minimum 56px (exceeds 44px WCAG guideline)
- [ ] Deduction workflow completable in 3 taps maximum
- [ ] Quick amount buttons functional and configurable
- [ ] Audio feedback plays on success/error
- [ ] UI renders correctly on iPad (1024x768) and Galaxy Tab (1280x800)
- [ ] Dark mode support maintained
- [ ] No regression in existing functionality

---

## Guardrails

### Must Have
- Maintain existing color system (coffee-brown primary)
- Keep dark mode support
- Preserve all existing functionality
- Touch targets >= 56px for primary actions
- Work offline-first (audio files bundled)

### Must NOT Have
- Do NOT modify Analytics, Settings, or Onboarding pages
- Do NOT change backend API contracts
- Do NOT remove existing button variants (add new `pos` variant)
- Do NOT break mobile phone layouts (< 768px)
- Do NOT add external audio dependencies

---

## Task Flow

```
Phase 1: Design Foundation
    │
    ├─► [1.1] Tailwind config update (POS tokens)
    ├─► [1.2] Button POS variant
    └─► [1.3] Input POS variant
           │
           ▼
Phase 2: Core Components
    │
    ├─► [2.1] Numpad component (NEW)
    ├─► [2.2] QuickAmountSelector component (NEW)
    ├─► [2.3] AudioFeedback utility (NEW)
    └─► [2.4] CustomerCard POS mode
           │
           ▼
Phase 3: Transaction Modals
    │
    ├─► [3.1] DeductModal POS transformation
    └─► [3.2] ChargeModal POS transformation
           │
           ▼
Phase 4: Dashboard & Customer List
    │
    ├─► [4.1] POS Dashboard layout
    └─► [4.2] Customer list with numpad search
           │
           ▼
Phase 5: Polish & Testing
    │
    ├─► [5.1] Audio files integration
    ├─► [5.2] Tablet responsive testing
    └─► [5.3] Dark mode verification
```

---

## Detailed TODOs

### Phase 1: Design Foundation

#### TODO 1.1: Update Tailwind Config with POS Tokens
**File**: `frontend/tailwind.config.js`
**Acceptance Criteria**:
- Add `pos` spacing values: `pos-sm: 48px`, `pos-md: 56px`, `pos-lg: 64px`
- Add `tablet` breakpoint: `768px`
- Add POS-specific shadows for depth
- Add transition timing for touch feedback

**Implementation Notes**:
```js
// Add to theme.extend
spacing: {
  'pos-sm': '48px',
  'pos-md': '56px',
  'pos-lg': '64px',
  'pos-xl': '80px',
},
screens: {
  'tablet': '768px',
  'tablet-lg': '1024px',
},
```

---

#### TODO 1.2: Add POS Button Variant
**File**: `frontend/src/components/common/Button.tsx`
**Acceptance Criteria**:
- Add `size="pos"` variant with 56px minimum height
- Add `size="pos-lg"` variant with 64px minimum height
- Include active state scale transform for touch feedback
- Font size 18px minimum for readability

**Implementation Notes**:
```tsx
// Size variants to add
pos: 'h-14 min-h-[56px] px-6 text-lg font-semibold rounded-xl active:scale-95 transition-transform',
'pos-lg': 'h-16 min-h-[64px] px-8 text-xl font-bold rounded-2xl active:scale-95 transition-transform',
```

---

#### TODO 1.3: Add POS Input Variant
**File**: `frontend/src/components/common/Input.tsx`
**Acceptance Criteria**:
- Add `size="pos"` variant with 56px height
- Larger font (18px) for readability
- Clear button for quick reset (X icon)
- Focus ring visible for accessibility

---

### Phase 2: Core Components

#### TODO 2.1: Create Numpad Component
**File**: `frontend/src/components/pos/Numpad.tsx` (NEW)
**Acceptance Criteria**:
- 3x4 grid layout (1-9, 0, backspace, clear)
- Each button 64px x 64px minimum
- Visual feedback on press (scale + color)
- Emits `onChange(value: string)` callback
- Supports max length prop

**Implementation Notes**:
```tsx
interface NumpadProps {
  value: string;
  onChange: (value: string) => void;
  maxLength?: number;
  onSubmit?: () => void;
}
```

**Layout**:
```
[ 1 ] [ 2 ] [ 3 ]
[ 4 ] [ 5 ] [ 6 ]
[ 7 ] [ 8 ] [ 9 ]
[ C ] [ 0 ] [ ⌫ ]
```

---

#### TODO 2.2: Create QuickAmountSelector Component
**File**: `frontend/src/components/pos/QuickAmountSelector.tsx` (NEW)
**Acceptance Criteria**:
- Grid of preset amount buttons
- Configurable amounts via props
- Selected state visual indicator
- "Custom" option to enter arbitrary amount
- Default presets: Deduct [4,500 / 5,000 / 5,500 / 6,000], Charge [10,000 / 30,000 / 50,000 / 100,000]

**Implementation Notes**:
```tsx
interface QuickAmountSelectorProps {
  amounts: number[];
  selectedAmount: number | null;
  onSelect: (amount: number) => void;
  onCustom: () => void;
  currency?: string; // default '원'
}
```

---

#### TODO 2.3: Create Audio Feedback Utility
**File**: `frontend/src/utils/audioFeedback.ts` (NEW)
**Acceptance Criteria**:
- `playSuccess()` - pleasant confirmation tone
- `playError()` - distinct error tone
- `playTap()` - subtle tap feedback (optional)
- Uses Web Audio API (no external files initially)
- Graceful fallback if audio not supported
- Respects user preference (can be disabled)

**Implementation Notes**:
```tsx
// Synthesized tones using Web Audio API
export const audioFeedback = {
  playSuccess: () => { /* 800Hz + 1000Hz chord, 150ms */ },
  playError: () => { /* 200Hz buzz, 200ms */ },
  playTap: () => { /* 600Hz click, 50ms */ },
  setEnabled: (enabled: boolean) => void,
};
```

---

#### TODO 2.4: Add POS Mode to CustomerCard
**File**: `frontend/src/components/customer/CustomerCard.tsx`
**Acceptance Criteria**:
- Add `variant="pos"` prop
- POS variant: Larger card (80px height min), bigger text
- Phone number prominently displayed (last 4 digits highlighted)
- Balance shown in large font
- Touch feedback on selection
- Selected state with border/shadow

**Implementation Notes**:
```tsx
interface CustomerCardProps {
  // ... existing
  variant?: 'default' | 'pos';
  selected?: boolean;
  onSelect?: () => void;
}
```

---

### Phase 3: Transaction Modals

#### TODO 3.1: Transform DeductModal for POS
**File**: `frontend/src/components/transaction/DeductModal.tsx`
**Acceptance Criteria**:
- Full-screen modal on tablet (or large centered modal)
- Quick amount buttons prominently displayed at top
- Selected menu item preview
- Large "Confirm Deduction" button (64px height, full width)
- Audio feedback on successful deduction
- Balance before/after preview
- 2-tap completion possible (amount → confirm)

**Layout Sketch**:
```
┌─────────────────────────────────────┐
│  [Customer Name]     Balance: ₩50,000│
├─────────────────────────────────────┤
│                                     │
│  Quick Amounts:                     │
│  ┌────────┐ ┌────────┐ ┌────────┐  │
│  │ ₩4,500 │ │ ₩5,000 │ │ ₩5,500 │  │
│  └────────┘ └────────┘ └────────┘  │
│  ┌────────┐ ┌────────┐ ┌────────┐  │
│  │ ₩6,000 │ │ ₩6,500 │ │ Custom │  │
│  └────────┘ └────────┘ └────────┘  │
│                                     │
│  Selected: ₩5,000                   │
│  New Balance: ₩45,000               │
│                                     │
├─────────────────────────────────────┤
│  ┌─────────────────────────────────┐│
│  │        차감하기 (₩5,000)         ││
│  └─────────────────────────────────┘│
│  [Cancel]                           │
└─────────────────────────────────────┘
```

---

#### TODO 3.2: Transform ChargeModal for POS
**File**: `frontend/src/components/transaction/ChargeModal.tsx`
**Acceptance Criteria**:
- Similar layout to DeductModal
- Quick amounts: 10,000 / 30,000 / 50,000 / 100,000
- Payment method selector (large touch buttons)
- Numpad for custom amount entry
- Audio feedback on successful charge

---

### Phase 4: Dashboard & Customer List

#### TODO 4.1: Create POS Dashboard Layout
**File**: `frontend/src/pages/Dashboard.tsx`
**Acceptance Criteria**:
- Split layout: Customer list (left 60%) + Action panel (right 40%)
- Prominent search bar with numpad below
- "Quick Deduct" as primary action (highlighted)
- "Charge" as secondary action
- Recent transactions mini-list (last 5)
- Tablet-optimized spacing

**Layout Sketch (Landscape Tablet)**:
```
┌──────────────────────────────────────────────────────────────┐
│  ☕ Café Name                              [Settings] [User] │
├────────────────────────────────┬─────────────────────────────┤
│                                │                             │
│  Search: [____] (last 4 digits)│   Selected Customer:        │
│  ┌─────────────────────────┐   │   ┌─────────────────────┐   │
│  │ Numpad                  │   │   │ 홍길동               │   │
│  │ [1] [2] [3]             │   │   │ Balance: ₩125,000   │   │
│  │ [4] [5] [6]             │   │   └─────────────────────┘   │
│  │ [7] [8] [9]             │   │                             │
│  │ [C] [0] [⌫]             │   │   ┌─────────────────────┐   │
│  └─────────────────────────┘   │   │    차감 (Deduct)    │   │
│                                │   └─────────────────────┘   │
│  Matching Customers:           │   ┌─────────────────────┐   │
│  ┌─────────────────────────┐   │   │    충전 (Charge)    │   │
│  │ 홍길동  010-****-1234   │   │   └─────────────────────┘   │
│  │ Balance: ₩125,000      │   │                             │
│  └─────────────────────────┘   │   Recent:                   │
│  ┌─────────────────────────┐   │   • 홍길동 -₩5,000 (2m ago)│
│  │ 김철수  010-****-1234   │   │   • 이영희 +₩30,000 (5m)   │
│  │ Balance: ₩45,000       │   │   • 박민수 -₩4,500 (8m)    │
│  └─────────────────────────┘   │                             │
│                                │                             │
└────────────────────────────────┴─────────────────────────────┘
```

---

#### TODO 4.2: Update Customers Page with Numpad Search
**File**: `frontend/src/pages/Customers.tsx`
**Acceptance Criteria**:
- Add numpad search mode (toggle or auto-detect tablet)
- Filter customers by last 4 digits of phone
- Results update as digits are entered
- Large customer cards with POS variant
- Direct tap to select → opens action panel

---

### Phase 5: Polish & Testing

#### TODO 5.1: Integrate Audio Feedback
**Files**: DeductModal, ChargeModal, relevant components
**Acceptance Criteria**:
- Success sound on completed transaction
- Error sound on failed transaction
- Optional tap sound on button press
- Add settings toggle for audio (store in localStorage)

---

#### TODO 5.2: Tablet Responsive Testing Checklist
**Acceptance Criteria**:
- [ ] iPad 10.2" (1620x2160 @ 264ppi) - Portrait & Landscape
- [ ] iPad Air (1640x2360) - Portrait & Landscape
- [ ] Galaxy Tab S7 (1600x2560) - Portrait & Landscape
- [ ] Touch targets >= 56px verified with DevTools
- [ ] No horizontal scroll
- [ ] No text truncation on primary actions

---

#### TODO 5.3: Dark Mode Verification
**Acceptance Criteria**:
- [ ] All new components support dark mode
- [ ] Numpad visible in dark mode
- [ ] Quick amounts readable in dark mode
- [ ] Sufficient contrast on all text (WCAG AA)

---

## Commit Strategy

| Commit | Description |
|--------|-------------|
| `feat(ui): add POS design tokens to Tailwind config` | Phase 1.1 |
| `feat(ui): add POS variants to Button and Input` | Phase 1.2-1.3 |
| `feat(pos): create Numpad component` | Phase 2.1 |
| `feat(pos): create QuickAmountSelector component` | Phase 2.2 |
| `feat(pos): add audio feedback utility` | Phase 2.3 |
| `feat(pos): add POS variant to CustomerCard` | Phase 2.4 |
| `feat(pos): transform DeductModal for POS workflow` | Phase 3.1 |
| `feat(pos): transform ChargeModal for POS workflow` | Phase 3.2 |
| `feat(pos): create POS-optimized Dashboard layout` | Phase 4.1 |
| `feat(pos): add numpad search to Customers page` | Phase 4.2 |
| `chore(pos): integrate audio feedback and polish` | Phase 5 |

---

## Success Criteria

### Quantitative
- Deduction workflow: **3 taps or less** (search → select → confirm)
- Touch targets: **>= 56px** on all primary actions
- Page load: **< 2 seconds** on tablet (no regression)

### Qualitative
- Staff can complete transaction without looking at keyboard
- Interface feels responsive and "snappy"
- Visual hierarchy clearly prioritizes deduction workflow
- Audio feedback confirms actions without being annoying

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Audio not working on some devices | Web Audio API with silent fallback |
| Numpad blocks existing search UX | Make numpad optional/toggleable |
| Dark mode contrast issues | Test each component in both modes |
| Tablet detection inaccurate | Use responsive classes, not JS detection |

---

## Out of Scope (Deferred)

- Backend API changes for quick amounts storage
- Settings page for configuring preset amounts
- Analytics page redesign
- Mobile phone (< 768px) specific optimizations
- Hardware integration (receipt printer, card reader)

---

## Next Steps

To begin implementation, run:
```
/start-work
```

Or delegate to implementation agent:
```
Task(subagent_type="oh-my-claude-sisyphus:sisyphus-junior", prompt="Implement Phase 1 of POS transformation plan at .sisyphus/plans/pos-transformation.md")
```
