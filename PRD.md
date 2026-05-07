# darkTunes Music Label Platform

A cutting-edge digital showcase for an alternative music label specializing in Gothic, Metal, Darkpop, Synthpop, Rock, Electro, and Industrial genres.

**Mission Statement**: Create an immersive, visually striking platform that embodies the darkTunes philosophy: "We don't follow trends—we create them."

**Experience Qualities**:
1. **Immersive** - Deep, atmospheric visuals that pull users into the dark aesthetic universe of alternative music
2. **Dynamic** - Fluid animations and smooth transitions that feel alive and contemporary
3. **Bold** - Unapologetically dark design with high-contrast elements and saturated accent colors

**Complexity Level**: Light Application (multiple features with basic state)
- This is a content showcase with interactive elements like artist browsing, release displays, newsletter signup, and music video integration. It features persistent state for user preferences but doesn't require complex multi-view navigation or advanced backend logic.

## Essential Features

### Release Radar
- **Functionality**: Displays the latest music releases with cover art, artist info, and streaming links
- **Purpose**: Immediately engage visitors with new content and drive streaming platform conversions
- **Trigger**: Page load on homepage
- **Progression**: User views hero section with featured release → Scrolls to see additional recent releases → Clicks on release card → Modal/expanded view with streaming links
- **Success criteria**: Release cards are visually prominent, cover art loads quickly, external links work correctly

### Artist Roster
- **Functionality**: Showcases signed artists with photos, bios, and music links
- **Purpose**: Build artist brand awareness and direct fans to their music
- **Trigger**: Navigate to Artists section or click artist name
- **Progression**: View artist grid → Click artist card → See expanded artist profile with bio, latest releases, and social links → Click through to streaming platforms
- **Success criteria**: All artists display correctly, smooth transitions between views, social links functional

### News Feed
- **Functionality**: Chronological display of label announcements, signings, and updates
- **Purpose**: Keep fans informed and create sense of active, growing label
- **Trigger**: Scroll down homepage or navigate to News section
- **Progression**: View news headlines → Click to read full article → Optionally share or return to feed
- **Success criteria**: News items load in correct order, dates display clearly, content is readable

### Newsletter Signup
- **Functionality**: Email collection form with validation
- **Purpose**: Build direct marketing channel independent of social media algorithms
- **Trigger**: User clicks newsletter CTA button
- **Progression**: User encounters CTA → Opens modal/form → Enters email → Receives confirmation
- **Success criteria**: Form validates email format, stores subscriptions persistently, shows success state

### Video Integration
- **Functionality**: Embedded music videos from YouTube
- **Purpose**: Showcase visual content and increase engagement time
- **Trigger**: Homepage load or navigation to Videos section
- **Progression**: User sees video thumbnails → Clicks to play → Video plays in embedded player
- **Success criteria**: Videos load reliably, thumbnails are high quality, playback works smoothly

## Edge Case Handling

- **No Releases Available**: Display placeholder message "New music coming soon" with atmospheric background
- **Failed Newsletter Submission**: Show error toast with retry option, don't lose user's entered email
- **Slow Image Loading**: Implement skeleton loaders for cover art and artist photos
- **Empty Artist Bio**: Show "Biography coming soon" instead of blank space
- **Broken External Links**: Validate streaming links exist before displaying buttons
- **Video Embed Failures**: Fallback to thumbnail image with "Watch on YouTube" direct link

## Design Direction

The design must evoke darkness, intensity, rebellion, and authenticity. It should feel like stepping into an underground music venue—visceral, atmospheric, and unapologetically alternative. High contrast between deep blacks and vibrant accent colors creates visual drama. Smooth animations suggest fluidity and modernity while the overall aesthetic remains rooted in the raw energy of alternative music culture.

## Color Selection

The palette breaks from traditional metal monotony by introducing saturated accent colors against an ultra-dark foundation.

- **Primary Color (Purple #493687 - oklch(0.35 0.15 290))**: Deep, rich violet inspired by album aesthetics. Communicates creativity and alternative culture. Used for primary CTAs, active navigation states, and focus indicators.

- **Secondary Color (Pink #7e1e37 - oklch(0.38 0.18 15))**: Bold magenta-red that adds energy and edge. Provides complementary contrast to primary purple. Used for secondary buttons, badges, and hover states on interactive elements.

- **Accent Color (Bright Purple oklch(0.65 0.25 290))**: Intensified version of primary for high-energy CTAs and important highlights like "New Release" badges and newsletter signup buttons.

- **Background (Near-Black #101010 - oklch(0.12 0 0))**: Almost pure black creating an immersive "dark mode" experience across the entire platform.

- **Surface (Dark Gray #292929 - oklch(0.20 0 0))**: Elevated surface color for cards, modals, and UI panels that need separation from background.

- **Border (Medium Gray #383838 - oklch(0.27 0 0))**: Subtle separation lines for inputs, cards, and disabled states.

- **Foreground/Background Pairings**:
  - Background (#101010): White text (#FFFFFF) - Ratio 17.3:1 ✓ (AAA)
  - Surface (#292929): White text (#FFFFFF) - Ratio 12.6:1 ✓ (AAA)
  - Primary (#493687): White text (#FFFFFF) - Ratio 6.8:1 ✓ (AA Large, AAA Normal)
  - Secondary (#7e1e37): White text (#FFFFFF) - Ratio 6.2:1 ✓ (AA Large, AA Normal)
  - Accent (oklch(0.65 0.25 290)): Black text (#000000) - Ratio 8.1:1 ✓ (AAA)

## Font Selection

Typography must convey edge, modernity, and readability while complementing the dark aesthetic without feeling generic or corporate.

**Primary Font**: **Outfit** - A geometric sans-serif with distinctive character that feels contemporary and bold without being overly technical. Its rounded terminals soften the stark contrast of the dark UI while maintaining strong presence.

**Secondary Font**: **Space Grotesk** - For headings and impactful statements. A space-age grotesque with sharp details that adds technical edge and futuristic flair appropriate for electronic and industrial music contexts.

- **Typographic Hierarchy**:
  - **H1 (Label Name / Hero)**: Space Grotesk Bold / 64px / -0.02em letter spacing / 1.1 line height
  - **H2 (Section Headers)**: Space Grotesk Bold / 40px / -0.01em / 1.2
  - **H3 (Artist Names, Release Titles)**: Outfit SemiBold / 28px / normal / 1.3
  - **Body (Bios, News)**: Outfit Regular / 16px / normal / 1.6
  - **Small (Metadata, Dates)**: Outfit Medium / 14px / normal / 1.4
  - **CTA Buttons**: Outfit Bold / 16px / 0.02em / uppercase

## Animations

Animations create fluidity and depth while maintaining performance. Use purposeful motion to guide attention and create memorable interactions.

**Principle**: Every animation serves function—establishing hierarchy, providing feedback, or creating spatial relationships. Avoid animation for decoration alone.

- **Page Load**: Staggered fade-up of hero elements (logo → title → featured release → CTA) with 100ms delays
- **Scroll-triggered**: Release cards and artist tiles fade in and translate up as they enter viewport
- **Hover States**: Release covers scale up 5% with smooth spring physics; buttons glow with accent color
- **Transitions**: Cross-fade between sections with 300ms ease-out timing
- **Micro-interactions**: Newsletter input focuses with subtle scale and border color shift; success state shows checkmark with bounce
- **Loading States**: Skeleton loaders pulse gently; spinners use accent color gradient

## Component Selection

**Components**:
- **Card**: For release covers, artist tiles, and news items with surface background and border
- **Button**: Primary (accent background), Secondary (primary background), Ghost (for less prominent actions)
- **Dialog**: For expanded artist bios and newsletter signup modal
- **Input**: For newsletter email with proper focus states
- **Scroll Area**: For artist roster and news feed with custom scrollbar styling
- **Badge**: For "New Release", genre tags, and status indicators
- **Separator**: Subtle dividers between news items
- **Hover Card**: For quick artist previews on hover

**Customizations**:
- **GlowCard**: Custom card component with animated gradient border for featured releases
- **VideoEmbed**: Wrapper for YouTube iframes with 16:9 aspect ratio lock
- **ArtistGrid**: Masonry-style grid layout for artist photos
- **ReleaseCarousel**: Horizontal scrolling release showcase with momentum scrolling

**States**:
- **Buttons**: Default (solid with subtle shadow) → Hover (scale 1.02, glow effect) → Active (scale 0.98) → Disabled (opacity 0.5, cursor not-allowed)
- **Inputs**: Default (border color) → Focus (accent border, subtle glow) → Error (red border, shake animation) → Success (green checkmark)
- **Cards**: Default (flat) → Hover (lift with shadow, scale transform) → Active (highlight border)

**Icon Selection**:
- **Play Icon** (Play from @phosphor-icons): Video and music playback
- **Envelope** (EnvelopeSimple): Newsletter signup
- **User** (UserCircle): Artist profiles
- **Music Note** (MusicNote): Releases and tracks
- **Globe** (Globe): External links to streaming platforms
- **Instagram/YouTube/Spotify** (Branded icons where appropriate)
- **Arrow Right** (ArrowRight): CTAs and navigation
- **X** (X): Close modals and dialogs

**Spacing**:
- Container max-width: 1400px
- Section vertical padding: 120px (desktop), 80px (mobile)
- Card gaps: 24px
- Component internal padding: 16px-24px based on hierarchy
- Button padding: 12px 32px (large CTA), 8px 20px (standard)

**Mobile**:
- Single column layout for releases and artists below 768px
- Hamburger menu for navigation below 1024px
- Touch-optimized hit areas (minimum 44px)
- Reduce font sizes by 20-30% on mobile
- Stack hero elements vertically
- Full-width cards with 16px side margins
- Reduce section padding to 60px vertical
