# **Bayou Fight Night - Application Specification**

Version: 3.0.1
Date: 2026-01-22
Status: Phase 3 Complete (Deep Data Expansion).

## **1. Executive Summary**

**Bayou Fight Night (BFN)** is a digital platform for managing and displaying regional combat sports data, specifically focused on Louisiana MMA, kickboxing, and grappling.

**Target Audience:**
1. **Fans/Public:** View rankings, upcoming events, fighter profiles, and gym affiliations.
2. **Promoters/Staff:** Manage the database, calculate Elo ratings, and organize fight cards.

## **2. Feature Status**

### **A. Public Interface**
* [x] **Rankings Board:** Dynamic Elo-based ranking table with Sport/Gender/Weight filtering.
* [x] **Event Center:** List of published events with detailed fight cards.
* [x] **Profiles:**
  * **Fighter:** Includes "Tale of the Tape" (Height, Reach, Stance, Age), Nickname, Bio, Fighting Style, and Nationality.
  * **Gym:** Roster, Win %, Location.
  * **Promotion:** Social links, HQ location, event history.
* [x] **Global Search:** Navigation bar search for Fighters, Events, and Gyms.
* [x] **Mobile Optimization**
  * Fixed bottom navigation bar for key actions (Rankings, Events, Dashboard).
  * Responsive padding and layout adjustments for touch interfaces.
  * **[New]** iOS Input Optimization: Standardized input font size to 16px to prevent auto-zooming.

### **B. Admin & Management (Protected)**
* [x] **Authentication:** Email/Password + Anonymous fallback.
* [x] **Dashboard:** Stats, Tools (Recompute/Seed/Clear), Security Interlocks.
* [x] **Fighter Manager:** Full "Tale of the Tape" data entry (DOB, Height, Reach, etc.).
* [x] **Event Manager:** Create drafts, Validate inputs, Publish/Unpublish.
* [x] **Gym Manager:** Basic CRUD.
* [x] **Promotion Manager:** Full CRUD with Socials/HQ data.
* [x] **Belt Manager:** Title management.
* [x] **Weight Class Manager:** Dynamic class creation.
* [x] **Fighting Style Manager:** CRUD for standardized fighting styles (e.g. "Muay Thai").
* [x] **Referee Manager:** CRUD for tracking officials.

### **C. The Ranking Engine**
* [x] **Elo Algorithm:** Custom K-Factors, Method multipliers, Inactivity decay.
* [x] **Snapshot Management:** Historical tracking of ranks.
* [x] **Clear Database:** Function removes all historical snapshots.

---

## **3. Database Schema Reference (Version 3.0)**

### **Collection: `fighters`**
* `id` (string)
* `fighter_name` (string)
* `first_name` (string), `last_name` (string)
* **[Added]** `nickname` (string)
* **[Added]** `dob` (string/ISO) - To calc age
* **[Added]** `height` (string) - e.g. "5'9"
* **[Added]** `reach` (string) - e.g. "72"
* **[Added]** `stance` (string) - orthodox, southpaw, switch
* **[Added]** `nationality` (string)
* **[Added]** `fighting_style_id` (ref)
* **[Added]** `bio` (text)
* `sport`, `gender`, `weight_class` (string)
* `gym_id` (ref)
* `hometown` (string)
* `active_status` (active/inactive)
* `photo_url` (string)

### **Collection: `bouts`**
* `id` (string)
* `event_id` (ref)
* `red_fighter_id`, `blue_fighter_id` (ref)
* `winner_id` (ref)
* `method` (enum: ko_tko, sub, etc.)
* **[Added]** `method_detail` (string) - e.g., "Rear Naked Choke"
* **[Added]** `round` (number)
* **[Added]** `time` (string) - e.g., "2:14"
* **[Added]** `referee_id` (ref)
* **[Added]** `scorecards` (string)
* `is_title_bout` (boolean), `belt_id` (ref)

### **Collection: `fighting_styles`**
* `id` (string)
* `name` (string)
* `description` (string)

### **Collection: `referees`**
* `id` (string)
* `name` (string)

---

## **4. Roadmap (Revised)**

### **Phase 4: Visuals & Gyms (Next Priority)**
* **Gym Enhancements:** Add Head Coach, Logo, and Socials to Gym Manager and Profiles.
* **Event Posters:** Add field for event flyer images.
* **Firebase Storage:** Replace text URLs with actual file uploads.

### **Phase 5: Engagement & "The War Room"**
* **Analyst Notes:** Add ability to annotate rankings.
* **Shareable Cards:** Generate "Top 10" or "Fight Card" images for social media.
* **The Matchmaker:** Predictive analytics tool (Red vs Blue simulation).
* **News Feed:** Blog system for fight announcements.

## **5. Technical Stack**
* **Frontend:** React, Tailwind CSS, Lucide React
* **Backend:** Firebase (Firestore, Auth, Hosting)
* **Build:** Vite
            