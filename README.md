# AfroVibe Studio

AfroVibe Studio is the artist and release-management workspace connected to the dedicated **AfroVibe Music** Supabase project. It is separate from the Elite Connectere campaign backend.

## Artist profile requirements

A profile must include:
- Artist/stage name
- Artist type
- Country and city
- Artist biography
- Profile photo
- Professional contact email
- Confirmation that the photo and profile information may be published

Legal name is private and optional. Primary language, official website, social links, existing music links, and management/label details are optional.

## Release submission requirements

A release cannot be submitted or approved unless it has:
- Release title and genre
- Supported release type
- One valid audio file and cover artwork
- Language and release date
- Explicit-content classification
- At least one producer, songwriter, or composer credit
- Distribution-rights confirmation
- Metadata-accuracy confirmation

Featured artists, individual credit fields when not applicable, record label, ISRC, UPC/EAN, lyrics, and description are optional. The credit group is required, but each individual credit field is optional when it does not apply.

Drafts may be saved incomplete and edited later. Submission and administrator approval are validated in both the Studio UI and the database. Artists cannot approve or publish their own submissions.

## Supported release type

Single-track releases are currently supported. EP, Album, and Mixtape publishing remain disabled until grouped multi-track release support is implemented; the interface must not imply those formats can be submitted as complete releases yet.

## Publication flow

Artist submits a release → Studio administrator reviews the audio, artwork, rights confirmations, and metadata → administrator approves → the approved release becomes available in AfroVibez on its release date.

Audio and artwork are stored in private buckets. Public listener access is limited to approved releases and approved media.