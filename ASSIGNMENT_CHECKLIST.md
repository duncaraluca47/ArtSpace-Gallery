# Assignment 0 - Bronze Challenge Checklist

## ✅ Complete Implementation Summary

---

## Requirement Engineering

### ✓ Task 0: Find a Client
**Client:** ArtSpace Gallery Management  
**Need:** Digital platform for showcasing and managing artwork collections

### ✓ Task 1: Extract Feature Set
**Core Features Identified:**
- Public presentation with branding
- User authentication (login/register)
- Full CRUD operations for artwork management
- Paginated gallery view with master/detail pattern

### ✓ Task 2: Create Requirements Document
**Location:** `/REQUIREMENTS.md` and `/requirements` page
**Structure:**
- Functional requirements (FR1-FR4)
- Non-functional requirements (NFR1-NFR3)
- Clear, structured, follows Occam's Razor principle

---

## Design Principles

### ✓ Task 0: Design Interview & Decisions

**Agreed Design Elements:**
- **Name:** ArtSpace Gallery
- **Tagline:** "Where creativity meets the world"
- **Logo:** Palette icon (representing artistic creativity)
- **Color Palette:**
  - White (#FFFFFF) - Clean background
  - Dark Gray (#2C2C2C) - Primary text
  - Gold (#D4AF37) - Accent/emphasis
  - Medium Gray (#666666) - Secondary text
- **Visual Style:** Minimalist, gallery-inspired, modern typography

### ✓ Task 1: Design Strategy
**Layout Principles Applied:**
- Desktop-first (1440px optimized)
- Consistent grid system
- Clear visual hierarchy
- Card-based artwork presentation
- Generous white space

### ✓ Task 2: Figma Visual Prototype
**Implementation:** React-based web application with all design specifications

---

## Bronze Challenge Requirements ✓

### 1. ✅ Login/Register Views

**Login Page** (`/login`)
- Email input field
- Password input field
- Login button
- Link to register page
- Centered card design

**Register Page** (`/register`)
- Username input field
- Email input field
- Password input field
- Confirm password input field
- Register button
- Link to login page

### 2. ✅ Presentation View

**Landing Page** (`/`)
- ✓ Logo: Palette icon in navigation
- ✓ Name: "ArtSpace Gallery" prominently displayed
- ✓ Tagline: "Where creativity meets the world"
- ✓ Description: Platform purpose and value proposition
- ✓ Call-to-Action: "Browse Gallery" button
- ✓ Featured Artworks: 3 artwork cards with images

### 3. ✅ Master/Detail Perspective with Full CRUD

#### Master View - Gallery Table (`/gallery`)
- ✓ **Table Display:**
  - Title column
  - Artist column
  - Year column
  - Price column
  - View action column
  
- ✓ **Pagination:**
  - Previous button
  - Page numbers (1, 2, 3)
  - Next button
  - 5 items per page
  
- ✓ **Create Operation:**
  - "Add Artwork" button → `/add-artwork`

#### Detail View - Artwork Detail (`/artwork/:id`)
- ✓ **Large artwork image**
- ✓ **Complete information:**
  - Title
  - Artist
  - Year
  - Category
  - Price
  - Description
  
- ✓ **Update Operation:**
  - "Edit Artwork" button → `/edit-artwork/:id`
  
- ✓ **Delete Operation:**
  - "Delete Artwork" button with confirmation dialog

#### Create/Update Forms
**Add Artwork Page** (`/add-artwork`)
- ✓ Title input
- ✓ Artist input
- ✓ Year input
- ✓ Price input
- ✓ Category input
- ✓ Description textarea
- ✓ Image upload placeholder
- ✓ "Save Artwork" button

**Edit Artwork Page** (`/edit-artwork/:id`)
- ✓ Pre-populated form with existing data
- ✓ All fields editable (Title, Artist, Year, Price, Category, Description)
- ✓ Current image displayed
- ✓ Option to upload new image
- ✓ "Save Changes" button

---

## Application Pages Overview

| Page | Route | Purpose | Bronze Requirement |
|------|-------|---------|-------------------|
| Landing Page | `/` | Presentation view | ✓ Presentation |
| Login | `/login` | User authentication | ✓ Login view |
| Register | `/register` | User registration | ✓ Register view |
| Gallery | `/gallery` | Master table view | ✓ Master view |
| Artwork Detail | `/artwork/:id` | Detail view | ✓ Detail view |
| Add Artwork | `/add-artwork` | Create form | ✓ Create (CRUD) |
| Edit Artwork | `/edit-artwork/:id` | Update form | ✓ Update (CRUD) |
| Requirements | `/requirements` | Assignment documentation | Documentation |

---

## Technical Implementation

### Technology Stack
- ✓ React 18.3.1
- ✓ React Router 7.13.0 (browser routing)
- ✓ Tailwind CSS 4.1.12 (styling)
- ✓ Lucide React (icons)
- ✓ Radix UI (form components)

### Component Architecture
- ✓ 7 page components (one per route)
- ✓ Shared Navigation component
- ✓ Reusable UI components (Input, Label, Textarea, Table)
- ✓ Centralized data model (`/src/app/data/artworks.ts`)

### Design Implementation
- ✓ Consistent color scheme across all pages
- ✓ Responsive hover states and transitions
- ✓ Clean, minimalist aesthetic
- ✓ Desktop-optimized (1440px width)
- ✓ Professional typography hierarchy

---

## Data Model

**Entity: Artwork**
```typescript
{
  id: string;           // Unique identifier
  title: string;        // Artwork title
  artist: string;       // Artist name
  year: number;         // Year created
  price: number;        // Price in USD
  category: string;     // Art category
  description: string;  // Detailed description
  imageUrl: string;     // Image URL
}
```

**Sample Data:** 6 artworks with real images from Unsplash

---

## Good Design Principles Applied

1. **Visual Hierarchy**
   - Clear distinction between headings, body text, and actions
   - Consistent use of color to indicate importance

2. **White Space**
   - Generous padding and margins
   - Content doesn't feel cramped

3. **Consistency**
   - Same navigation on all pages
   - Uniform button styles
   - Consistent form layouts

4. **Feedback**
   - Hover states on interactive elements
   - Active page indication in navigation
   - Confirmation dialog for destructive actions

5. **Accessibility**
   - Form labels for all inputs
   - Semantic HTML structure
   - Clear call-to-action buttons

6. **Simplicity (Occam's Razor)**
   - Clean, uncluttered interfaces
   - Only essential features included
   - Intuitive navigation structure

---

## How to Navigate the Application

1. **Start** at Landing Page (`/`) - See branding and featured artworks
2. **Browse** the Gallery (`/gallery`) - View all artworks in table format
3. **View Details** - Click "View" on any artwork
4. **Create** - Click "Add Artwork" from gallery page
5. **Update** - Click "Edit Artwork" from detail page
6. **Delete** - Click "Delete Artwork" from detail page (with confirmation)
7. **Authenticate** - Access Login (`/login`) or Register (`/register`)
8. **Documentation** - View Requirements page (`/requirements`)

---

## Assignment Completion Status

| Requirement | Status | Evidence |
|-------------|--------|----------|
| Requirement Engineering - Client | ✅ Complete | ArtSpace Gallery documented |
| Requirement Engineering - Features | ✅ Complete | Full feature set extracted |
| Requirement Engineering - Documentation | ✅ Complete | REQUIREMENTS.md created |
| Design - Color Palette | ✅ Complete | White, Dark Gray, Gold |
| Design - Visual Style | ✅ Complete | Minimalist, modern |
| Design - Logo & Name | ✅ Complete | Palette icon, ArtSpace Gallery |
| Design - Tagline | ✅ Complete | "Where creativity meets the world" |
| Bronze - Login/Register | ✅ Complete | Both views implemented |
| Bronze - Presentation View | ✅ Complete | Landing page with all elements |
| Bronze - Master Table | ✅ Complete | Paginated gallery table |
| Bronze - Detail View | ✅ Complete | Artwork detail pages |
| Bronze - CRUD Create | ✅ Complete | Add artwork form |
| Bronze - CRUD Read | ✅ Complete | Gallery & detail views |
| Bronze - CRUD Update | ✅ Complete | Edit artwork form |
| Bronze - CRUD Delete | ✅ Complete | Delete with confirmation |

---

## ✅ All Bronze Challenge Requirements Met

The application successfully implements all requirements for the bronze challenge with a clean, professional design following modern web development best practices.

**Date:** March 11, 2026  
**Project:** ArtSpace Gallery  
**Assignment:** Systems for Design and Implementation - Assignment 0
