# **Bayou Fight Night - Application Specification**

Version: 2.5.1 (Planning Update)
Date: 2026-01-22
Status: Phase 2 Complete. Planning Phase 3 (Deep Data Expansion).

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
  * **Fighter:** Basic Record, Gym, Stats.
  * **Gym:** Roster, Win %, Location.
  * **Promotion:** Social links, HQ location, event history.
* [x] **Global Search:** Navigation bar search for Fighters, Events, and Gyms.

### **B. Admin & Management (Protected)**
* [x] **Authentication:** Email/Password + Anonymous fallback.
* [x] **Dashboard:** Stats, Tools (Recompute/Seed/Clear), Security Interlocks.
* [x] **Fighter Manager:** Create/Edit/Delete.
* [x] **Event Manager:** Create drafts, Validate inputs, Publish/Unpublish.
* [x] **Gym Manager:** Basic CRUD.
* [x] **Promotion Manager:** Full CRUD with Socials/HQ data.
* [x] **Belt Manager:** Title management.
* [x] **Weight Class Manager:** Dynamic class creation.

### **C. The Ranking Engine**
* [x] **Elo Algorithm:** Custom K-Factors, Method multipliers, Inactivity decay.
* [x] **Snapshot Management:** Historical tracking of ranks.

---

## **3. Database Schema Reference (Current & Planned)**

This section outlines the data structure required to match industry standards (Sherdog/Tapology).
**[New]** denotes fields/collections to be added in the next sprints.

### **Collection: `fighters`**
* `id` (string)
* `fighter_name` (string)
* `first_name` (string), `last_name` (string)
* **[New]** `nickname` (string) - e.g., "The Diamond"
* **[New]** `birth_date` (string/ISO) - To calc age
* **[New]** `height` (string/number) - e.g., "5'9" or inches
* **[New]** `reach` (string/number) - inches
* **[New]** `stance` (enum: orthodox, southpaw, switch)
* **[New]** `nationality` (string/code)
* **[New]** `fighting_style_id` (ref) - Reference to `fighting_styles` collection
* **[New]** `bio` (text) - Short background/achievements
* `sport`, `gender`, `weight_class` (string)
* `gym_id` (ref)
* `hometown` (string)
* `active_status` (active/inactive)
* `photo_url` (string)
* **[New]** `record_split` (object): `{ pro: {w,l,d,nc}, amateur: {w,l,d,nc} }`

### **Collection: `events`**
* `id` (string)
* `name`, `slug` (string)
* `promotion_id` (ref)
* `event_date` (ISO date)
* `venue`, `city`, `state` (string)
* `is_published` (boolean)
* **[New]** `poster_url` (string) - Official Event Flyer
* **[New]** `broadcast_info` (string) - e.g., "UFC Fight Pass"

### **Collection: `bouts`**
* `id` (string)
* `event_id` (ref)
* `red_fighter_id`, `blue_fighter_id` (ref)
* `winner_id` (ref)
* `method` (enum: ko_tko, sub, etc.)
* **[New]** `method_detail` (string) - e.g., "Rear Naked Choke", "Flying Knee"
* `round`, `time` (number/string) - **[Update]** Ensure time is tracked (e.g., "2:14")
* **[New]** `referee_id` (ref) - Reference to `referees` collection
* **[New]** `scorecards` (string/array) - e.g., "29-28, 29-28, 30-27"
* `is_title_bout` (boolean), `belt_id` (ref)

### **Collection: `gyms`**
* `id` (string)
* `name`, `slug`, `city`, `state` (string)
* **[New]** `head_coach` (string)
* **[New]** `logo_url` (string)
* **[New]** `socials` (object: fb, insta, web)

### **Collection: `promotions`**
* `id` (string)
* `name`, `acronym`, `region` (string)
* `hq_city`, `hq_state` (string)
* `socials` (object: fb, insta, x, tapology, **[New]** youtube)
* `website`, `logo_url` (string)

### **[New] Collection: `fighting_styles`**
* `id` (string)
* `name` (string) - e.g., "Muay Thai", "Wrestler", "BJJ Specialist"
* `description` (string)

### **[New] Collection: `referees`**
* `id` (string)
* `name` (string)
* `total_bouts_managed` (number) - auto-calc

### **Collection: `rankings_snapshots`**
* Standard fields (rank, fighter_id, score, etc.)
* **[New]** `analyst_notes` (string) - "Why they are ranked here"

---

## **4. Roadmap (Revised)**

### **Phase 3: Deep Data (Immediate Priority)**
* **Fighter "Tale of the Tape":** Implement expanded fighter schema (Height, Reach, Stance, Nickname, Bio).
* **Fighting Styles Manager:** CRUD for fighting styles; link to fighters.
* **Referees Manager:** CRUD for referees.
* **Bout Detail Expansion:** Add Time, Specific Method, Referee, and Scorecards to Bout Entry form.
* **Record Separation:** Logic to calculate and display Amateur vs Pro records independently.

### **Phase 4: Visuals & Gyms**
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
            