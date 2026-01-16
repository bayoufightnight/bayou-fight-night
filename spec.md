Bayou Fight Night - Application Specification

Version: 2.1
Date: 2026-01-16
Status: Phase 2 Complete (Management & Auth)

1. Executive Summary

Bayou Fight Night (BFN) is a digital platform for managing and displaying regional combat sports data, specifically focused on Louisiana MMA, kickboxing, and grappling.

Target Audience:

Fans/Public: View rankings, upcoming events, fighter profiles, and gym affiliations.

Promoters/Staff: Manage the database, calculate Elo ratings, and organize fight cards.

2. Feature Status

A. Public Interface

[x] Rankings Board

Dynamic Elo-based ranking table.

Filtering by Sport, Gender, and Weight Class.

Visual Trend Indicators (Up/Down/New).

Champion Badges for title holders.

[x] Event Center

List of published events.

Detailed fight cards (Red vs Blue).

Visual cues for winners/method.

[x] Profiles

Fighter: Record, History, Gym, Stats.

Gym: Roster, Win %, Location.

Promotion: History, Champions.

[x] Global Search

Navigation bar search for Fighters, Events, and Gyms.

B. Admin & Management (Protected)

[x] Authentication

Email/Password Login (signInWithEmailAndPassword).

Public/Anonymous fallback.

Session persistence and Sign Out.

[x] Dashboard

Database statistics (entity counts).

Quick Action shortcuts.

System Tools (Recompute, Seed, Import/Export/Clear).

[x] Fighter Manager

Create/Register Fighters.

Delete Fighters (with confirmation).

[x] Event Manager

Create Event Drafts.

Bout Maker: Conflict detection (prevents double-booking).

Publishing Flow: Draft -> Published (Live) -> Unpublished (Edit).

[x] Gym Manager

Register Gyms (Name, City, State).

Delete Gyms.

[x] Belt Manager

Create Titles.

Auto-update champions based on bout results.

C. The Ranking Engine

[x] Elo Algorithm

Custom combat-sports adaptation.

K-Factor adjustments based on experience.

Method of victory multipliers.

Inactivity decay.

3. Roadmap (Needs & Future Features)

Priority 1: Data Completeness

[ ] Promotion Manager: UI to add new organizations (e.g., "UFC", "Fury FC") to support historical accuracy.

[ ] Result Details: Add "Time", "Round", and "Referee" fields to bout results.

Priority 2: Phase 3 - The Matchmaker ("The War Room")

[ ] Predictive Analytics: Tool for promoters to simulate matchups.

[ ] Stakes Calculator: Projected rating changes shown before booking.

[ ] Fairness Meter: Visual mismatch flagging.

Priority 3: Media & Assets

[ ] Firebase Storage: Upload actual image files instead of text URLs.

[ ] Image Processing: Auto-crop/resize for avatars.

Priority 4: Engagement & Scale

[ ] News Feed: Blog/Announcement system.

[ ] Countdown Timer: Home page widget for next event.

[ ] Pagination: Lazy loading for fighter/bout lists to handle scale >500 records.

[ ] Security Rules: Server-side Firestore rules enforcement.

4. Technical Stack

Frontend: React, Tailwind CSS, Lucide React

Backend: Firebase (Firestore, Auth, Hosting)

Build: Vite