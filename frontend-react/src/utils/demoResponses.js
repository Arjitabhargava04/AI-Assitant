// src/utils/demoResponses.js
// Static demo responses shown to guest users (not logged in).
// No backend API calls — pure UI demo.
// Uses MARKDOWN syntax (since AIBubble renders markdown, not HTML).

export const GREETINGS = [
  {
    heroImage: '/demo/greeting-1.png',
    title: 'Hello, Heritage Explorer ✨',
    markdown: `I'd love to share India's incredible heritage with you — from **Sanchi Stupas** to **Chola bronzes**, from **Indus seals** to **Khajuraho sculptures**.

I can help you explore:

- Ancient temples, monuments and stupas
- Inscriptions, epigraphy and ancient scripts
- Sculptures, iconography and artefacts
- Dynasties, rulers and historical periods

---

*Please sign in to chat with me about anything you wish to explore.*`,
    cta: 'Please sign in to chat with me about anything you wish to explore.',
  },
  {
    heroImage: '/demo/greeting-2.png',
    title: 'Welcome to Vikramaditya AI 🏛️',
    markdown: `I'm an AI specialised in **Indian heritage, archaeology and culture**. I can analyse monuments from photos, transcribe inscriptions, identify sculptural styles, and trace historical narratives.

I work with **text, images, audio and video** — upload anything from a temple photograph to a recorded lecture, and I'll help you understand it.

---

*Login or sign up to unlock the full conversation.*`,
    cta: 'Login or sign up to unlock the full conversation.',
  },
];

export const TOPICS = {
  'ancient-sites': {
    question: 'Tell me about ancient sites of Madhya Pradesh',
    heroImage: '/demo/topic-sites.jpg',
    title: 'Ancient Sites of Madhya Pradesh',
    markdown: `Madhya Pradesh holds some of India's most extraordinary heritage — a living museum of stone, sculpture and story.

### Sanchi — Buddha's Silent Witness

The **Great Stupa at Sanchi**, commissioned by **Emperor Ashoka in the 3rd century BCE**, is the oldest stone structure in India. Its four ornate toranas (gateways) narrate Jataka tales in exquisite relief — a UNESCO World Heritage Site since 1989.

### Khajuraho — Poetry in Stone

Built by the **Chandela dynasty (950–1050 CE)**, these temples are celebrated for their fluid sculptural grammar — celestial dancers, divine couples, and intricate Nagara-style architecture. Of the original 85 temples, 25 survive today.

### Bhimbetka — India's First Canvas

Rock shelters in the Vindhya hills holding **30,000-year-old paintings** — humanity's earliest visual records on the subcontinent.

### Other Notable Sites

- **Mandu** — Afghan-style palace ensemble
- **Orchha** — Bundela Rajput cenotaphs and temples
- **Gwalior Fort** — "the pearl among Indian fortresses"

---

*Curious about any specific site? Sign in to ask detailed questions or upload photos for analysis.*`,
    cta: 'Curious about any specific site? Sign in to ask detailed questions or upload photos for analysis.',
  },
  'inscriptions': {
    question: 'What are inscriptions and epigraphy?',
    heroImage: '/demo/topic-inscriptions.jpg',
    title: 'Inscriptions & Epigraphy',
    markdown: `**Epigraphy** is the study of inscriptions — texts engraved on stone, copper plates, pottery, and metal. These are India's most reliable historical witnesses, surviving where palm-leaf manuscripts have perished.

### Why They Matter

Inscriptions give us **dates we can trust, names of rulers, land grants, military victories**, and even ancient property disputes. They are the spine of Indian historical reconstruction.

### Famous Examples

- **Ashokan Edicts** — Brahmi script, 3rd century BCE
- **Allahabad Pillar** — Samudragupta's exploits in Sanskrit kāvya
- **Aihole Inscription** — Pulakeshin II's victories
- **Hathigumpha Inscription** — Kharavela's biography in Brahmi

### Scripts to Know

**Brahmi** (ancestor of most Indic scripts), **Kharoshthi**, **Devanagari**, **Grantha**, **Vatteluttu**, and the regional medieval forms.

---

*Want me to read an inscription from a photo? Login and upload an image — I specialise in deciphering ancient scripts.*`,
    cta: 'Want me to read an inscription from a photo? Login and upload an image — I specialise in deciphering ancient scripts.',
  },
  'excavations': {
    question: 'Tell me about archaeological excavations in India',
    heroImage: '/demo/topic-excavations.jpg',
    title: 'Excavation Reports & Discoveries',
    markdown: `The **Archaeological Survey of India (ASI)**, founded in 1861, has uncovered civilisations that rewrote world history.

### The Great Indus Discoveries

**Harappa** (Daya Ram Sahni, 1921) and **Mohenjo-daro** (R.D. Banerji, 1922) revealed a 5000-year-old urban civilisation with planned grids, drainage systems, and a script we still cannot read.

### Recent Highlights

- **Keeladi, Tamil Nadu** — Sangam-era urban settlement
- **Rakhigarhi, Haryana** — Largest known Harappan site
- **Sinauli, UP** — Bronze Age chariots
- **Adichanallur** — Iron Age urn burials

### Modern Methods

Today's excavations combine **stratigraphic digging** with **carbon-14 dating, satellite imagery, ground-penetrating radar, and ancient DNA analysis**.

---

*Want detailed info on any excavation site? Sign in to explore findings, dating methods, and ongoing research.*`,
    cta: 'Want detailed info on any excavation site? Sign in to explore findings, dating methods, and ongoing research.',
  },
  'artifacts': {
    question: 'Tell me about ancient artifacts and museum collections',
    heroImage: '/demo/topic-artifacts.jpg',
    title: 'Artifacts & Collections',
    markdown: `Artefacts are time capsules — every potsherd, every coin, every bronze figurine carries a fingerprint of the civilisation that made it.

### Categories

- **Stone sculptures** — Mauryan polish, Mathura red sandstone, Gandhara grey schist
- **Bronzes** — Lost-wax Chola masterpieces, especially Nataraja
- **Coins** — Punch-marked, Indo-Greek, Kushan gold, Gupta, Mughal
- **Terracotta** — Sunga-era figurines, Harappan toys
- **Manuscripts** — Palm-leaf, birch-bark, illuminated paper folios

### Major Indian Museums

- **Indian Museum, Kolkata** — oldest, founded 1814
- **National Museum, Delhi** — comprehensive subcontinental holdings
- **Government Museum, Chennai** — Chola bronzes par excellence
- **CSMVS, Mumbai** — Indo-Saracenic gem

---

*Got a photo of an artefact? Login and upload it — I will identify the style, period, and likely region.*`,
    cta: 'Got a photo of an artefact? Login and upload it — I will identify the style, period, and likely region.',
  },
  'conservation': {
    question: "How is India's heritage being conserved?",
    heroImage: '/demo/topic-conservation.jpg',
    title: 'Heritage Conservation',
    markdown: `India has **over 3,600 ASI-protected monuments** and **42 UNESCO World Heritage Sites**. Protecting this inheritance is a continuous, layered effort.

### The Principles

Modern conservation follows the **Venice Charter (1964)** and **Burra Charter** — minimum intervention, reversibility, respect for authenticity.

### Key UNESCO Sites

- **Cultural**: Taj Mahal, Ajanta & Ellora, Hampi, Mahabalipuram, Khajuraho, Sanchi, Konark
- **Natural**: Western Ghats, Sundarbans, Kaziranga, Nanda Devi

### Challenges

- **Climate & pollution** — yellowing of Taj Mahal marble
- **Tourism pressure** — visitor footfall
- **Encroachment** — unauthorised construction near protected zones
- **Illicit trade** — smuggling of bronzes, manuscripts, sculptures

---

*Interested in a specific monument or conservation project? Sign in to ask in depth.*`,
    cta: 'Interested in a specific monument or conservation project? Sign in to ask in depth.',
  },
};

// Topic card list (in display order)
export const TOPIC_CARDS = [
  { key: 'ancient-sites', title: 'Ancient Sites of\nMadhya Pradesh', image: '/demo/topic-sites.jpg' },
  { key: 'inscriptions',  title: 'Inscriptions &\nEpigraphy',       image: '/demo/topic-inscriptions.jpg' },
  { key: 'excavations',   title: 'Excavation\nReports',             image: '/demo/topic-excavations.jpg' },
  { key: 'artifacts',     title: 'Artifacts &\nCollections',        image: '/demo/topic-artifacts.jpg' },
  { key: 'conservation',  title: 'Heritage\nConservation',          image: '/demo/topic-conservation.jpg' },
];