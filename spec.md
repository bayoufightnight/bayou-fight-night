# **Bayou Fight Night - Application Specification**

Version: 2.5.1
Date: 2026-01-21
Status: Phase 2 Refined (Bug Fixes)

## **1. Executive Summary**

**Bayou Fight Night (BFN)** is a digital platform for managing and displaying regional combat sports data, specifically focused on Louisiana MMA, kickboxing, and grappling.

**Target Audience:**

1. **Fans/Public:** View rankings, upcoming events, fighter profiles, and gym affiliations.
2. **Promoters/Staff:** Manage the database, calculate Elo ratings, and organize fight cards.

## **2. Feature Status**

### **A. Public Interface**

* [x] **Rankings Board**
  * Dynamic Elo-based ranking table.
  * Filtering by Sport, Gender, and Weight Class.
  * Visual Trend Indicators (Up/Down/New).
  * Champion Badges for title holders.
* [x] **Event Center**
  * List of published events.
  * Detailed fight cards (Red vs Blue).
  * Visual cues for winners/method.
* [x] **Profiles**
  * **Fighter:** Record, History, Gym, Stats.
  * **Gym:** Roster, Win %, Location.
  * **Promotion:** Enhanced profile view including social links, headquarters location, and event history.
* [x] **Global Search**
  * Navigation bar search for Fighters, Events, and Gyms.
* [x] **Mobile Optimization**
  * Fixed bottom navigation bar for key actions (Rankings, Events, Dashboard).
  * Responsive padding and layout adjustments for touch interfaces.

### **B. Admin & Management (Protected)**

* [x] **Authentication (Enhanced)**
  * Email/Password Login (signInWithEmailAndPassword).
  * **Stability:** Added fallback to Anonymous Auth if Custom Token fails.
  * Session persistence and Sign Out.
* [x] **Dashboard**
  * Database statistics (entity counts).
  * Quick Action shortcuts.
  * System Tools (Recompute, Seed, Import/Export/Clear).
  * **Security Interlocks:** Requires typing "CLEAR" to wipe database.
* [x] **Fighter Manager**
  * Create/Register Fighters.
  * **Edit Fighters:** Ability to update existing fighter details.
  * Delete Fighters (with confirmation).
* [x] **Event Manager (Fixed)**
  * Create Event Drafts.
  * **Stability:** Added validation to prevent creating events without a Promotion ID (fixed undefined error).
  * **Bout Maker:** Conflict detection (prevents double-booking).
  * **Publishing Flow:** Draft -> Published (Live) -> Unpublished (Edit).
* [x] **Gym Manager**
  * Register Gyms (Name, City, State).
  * Delete Gyms.
* [x] **Promotion Manager**
  * Full CRUD for Fight Organizations.
  * Tracks: Name, Acronym, HQ City/State, Region, AKA (Aliases), Website, Logo URL.
  * Social Media Link Management.
* [x] **Belt Manager**
  * Create Titles.
  * Auto-update champions based on bout results.
* [x] **Weight Class Manager**
  * Dynamic creation of weight classes per Sport/Gender.

### **C. The Ranking Engine**

* [x] **Elo Algorithm**
  * Custom combat-sports adaptation.
  * K-Factor adjustments based on experience.
  * Method of victory multipliers.
  * Inactivity decay.
* [x] **Snapshot Management**
  * Rankings page filters by latest snapshot date to prevent duplication.
  * Clear Database function removes all historical snapshots.

## **3. Roadmap (Needs & Future Features)**

### **Priority 1: Details & Analytics**

* [ ] **Result Details:** Add "Time", "Round", and "Referee" fields to bout results.
* [ ] **The Matchmaker ("The War Room"):** Predictive analytics tool to simulate matchups and view projected rating changes.

### **Priority 2: Media & Assets**

* [ ] **Firebase Storage:** Upload actual image files instead of text URLs.
* [ ] **Image Processing:** Auto-crop/resize for avatars.

### **Priority 3: Engagement & Scale**

* [ ] **News Feed:** Blog/Announcement system.
* [ ] **Countdown Timer:** Home page widget for next event.
* [ ] **Pagination:** Lazy loading for fighter/bout lists to handle scale >500 records.
* [ ] **Security Rules:** Server-side Firestore rules enforcement.

## **4. Technical Stack**

* **Frontend:** React, Tailwind CSS, Lucide React
* **Backend:** Firebase (Firestore, Auth, Hosting)
* **Build:** Vite
            