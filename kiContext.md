# Gainalytics – Agent Context

This file defines the binding technical context and coding rules for AI coding agents working on Gainalytics.

Agents MUST follow these conventions when creating or modifying code.

---

# Project Overview

- Project name: Gainalytics
- Platform: React Native Mobile App
- Language: TypeScript
- App language: English only (UI, buttons, labels, messages)
- Target users: Advanced gym athletes / power users
- Architecture goal: Offline-first, privacy-first, extensible

---

# Tech Stack

Core:

- React Native 0.72.6
- TypeScript
- Redux (global state)
- React Navigation
- React Native Paper (UI framework)
- StyleSheet API (styling) / React Native Paper Theme

Storage & Performance:
- react-native-mmkv (high performance storage)
- @shopify/flash-list (for all long lists)

Testing:

- Jest
- React Native Testing Library

Performance:

- FlashList for large lists

Agents MUST NOT introduce new frameworks without explicit instruction.

---

# Project Structure

Key directories:

/app  
/components → reusable UI components  
/tabs → navigation screens and main features (Analyse, exercises, settings, trainings)
/models → data models, enums and types (entities in /entities subdirectory)
/redux → Redux store, slices, selectors  
/routing → navigation configuration  
/utils → helpers for calculations, date handling, and data export

Agents MUST place new files in the correct directory.

---

# Core Domain Model

Defined in:

/app/models/entities (e.g., Exercise, Training, Workout, WorkoutSet)

Key entities:

- Training
- TrainingsPlan
- TrainingsState
- Exercise
- Workout
- WorkoutSet

Agents MUST reuse existing models and MUST NOT duplicate model definitions.

---

# Component Rules (MANDATORY)

Components MUST:

- be functional components
- use TypeScript
- define Props interface above component
- place styles at end of file
- stay below 200 lines if possible
- extract subcomponents if component grows too large

---

# State Management Rules

Global state:

- MUST use Redux with Normalized State pattern (`byId`, `allIds`)
- MUST use selectors for reading state
- MUST NOT access store directly
- Redux structure uses `reduce-reducers` for cross-cutting actions (see `rootReducer.ts`)
- Action types are often defined as strings directly in the reducer switch-case

Local state:

- useState for local UI state
- useMemo for derived values
- useCallback for event handlers

IMPORTANT: Reducers MUST be pure. Do not mutate the state object directly (prefer spread operator).

Agents MUST avoid unnecessary re-renders.

---

# Styling Rules (STRICT)

Agents MUST:

- use StyleSheet.create
- use theme.colors for colors
- MUST use React Native Paper components (Button, Card, Text, etc.) for consistent UI
- NOT hardcode colors
- NOT use inline style objects except for trivial layout

---

# Navigation Rules

- Navigation uses React Navigation
- Screens belong in /app/tabs
- Reusable UI belongs in /app/components
- Business logic MUST NOT live in navigation files

---

# Performance Rules

Agents MUST apply these when relevant:

- use memo() for pure components
- useCallback for event handlers
- useMemo for expensive computations
- use FlashList instead of FlatList for large lists
- avoid unnecessary state updates

---

# Naming Conventions

Components:
PascalCase

Variables / functions:
camelCase

Constants:
UPPER_CASE

Files:
kebab-case.ts (for logic, reducers, utils)
PascalCase.tsx for components

---

# Testing Rules

Agents SHOULD create tests when adding logic.

Use:

- Jest
- React Native Testing Library

Test:

- business logic
- reducers
- do not use as for TypeInterference. Use satisfies.
- components

---

# Architecture Principles

Agents MUST follow:

- functional programming principles where possible
- separation of UI and business logic
- reusable components
- single responsibility per component

Agents MUST NOT:

- introduce global mutable state outside Redux
- duplicate logic unnecessarily
- hardcode data that belongs in models or store

---

# Definition of Done

Code is complete when:

- TypeScript has no errors
- follows all rules in this file
- no obvious performance issues
- no duplicate logic introduced
- component structure follows conventions
- tests are green and code is covered
