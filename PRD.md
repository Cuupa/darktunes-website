# darkTunes Music Label Platform

A cutting-edge digital showcase for an alternative music label specializing in Gothic, Metal, Darkpop, Synthpop, Rock, Electro, and Industrial genres.

2. **Dynamic** - Fluid animations and smooth transitions that feel alive and contemporary

- This is a content showc
## Essential Features
2. **Dynamic** - Fluid animations and smooth transitions that feel alive and contemporary
3. **Bold** - Unapologetically dark design with high-contrast elements and saturated accent colors

**Complexity Level**: Light Application (multiple features with basic state)
- This is a content showcase with interactive elements like artist browsing, release displays, newsletter signup, and music video integration. It features persistent state for user preferences but doesn't require complex multi-view navigation or advanced backend logic.

## Essential Features

- **Purpose**: Ke
- **Progression**: View news headlines → Click to read full article → Optionally share or return to feed

- **Functionality**: Email collectio
- **Trigger**: User clicks newsletter CTA button
- **Success criteria**: Form validates email format, stores subscriptions persistently, shows success state

- **Purpose**: Sh
- **Progression**: User sees video thumbnails → Clicks to play → Video plays in 


- **Failed Newsletter Submission**: Show error toast with retry option, don't lose user's entered email
- **Empty Artist Bio**: Show "Biography coming soon" instead of blank space

## Design Dir
The design must evoke darkness, intensity, rebellion, and authenticity. It should feel l
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

**Customizations**

- **ReleaseCarousel**: Horizontal scrolling release showcase with momentum scrolling

- **Inputs**: Default (border color) → Focus (accent border, subtle glow) → Error (red border, shake animation) → Success (green checkmark)

- **Play Icon** (Play from @phosphor-icons): Video and music playback

- **Globe** (Globe): External links to streaming platforms



- Card gaps: 24px

**Mobile**:

- Reduce font sizes by 20-30% on mobi
- Full-width cards with 16px side margins


















































- **ReleaseCarousel**: Horizontal scrolling release showcase with momentum scrolling



- **Inputs**: Default (border color) → Focus (accent border, subtle glow) → Error (red border, shake animation) → Success (green checkmark)



- **Play Icon** (Play from @phosphor-icons): Video and music playback



- **Globe** (Globe): External links to streaming platforms







- Card gaps: 24px



**Mobile**:





- Full-width cards with 16px side margins

