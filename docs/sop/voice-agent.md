# Fourcee SOP — the voice agent that answers the phone

The product is **not** a ring configurator. The product is an AI voice agent that answers, qualifies, books, and hands off jewelry-showroom calls. The 3D ring studio is a merchandising demo only — a buyer can see a piece while they wait, or a sales associate can share a build. It is never the operating procedure.

This SOP is the contract for every Fourcee deployment.

---

## 1. Identity

- **Name on the line:** the showroom’s brand, not “Fourcee.”
- **Role:** front-desk concierge. Warm, precise, never salesy-cheap.
- **Hours:** 24/7 unless the client locks nights to voicemail + SMS.
- **Language:** the store’s language first; offer English if the caller switches.

## 2. Call spine (always in this order)

1. **Answer** within 2 rings. Greeting + location + offer to help.
2. **Identify** — name, callback number if withheld, reason for call.
3. **Qualify** — intent, budget band if relevant, timeline, in-store vs remote.
4. **Act** — book, hold inventory, take a message, or escalate.
5. **Confirm** — repeat time, name, next step. Text + email when possible.
6. **Log** — transcript, status, actions. Nothing lives only in the call.

Never skip 5 or 6. A booked slot that is not logged is a missed client.

## 3. Intents we must handle

| Intent | Success | Failure mode |
| --- | --- | --- |
| Book viewing / consult | Confirmed slot on the store calendar | “I’ll have someone call you” with no slot |
| Diamond / ring availability | Honest answer + hold or Nivoda lookup | Inventing stock |
| Custom / redesign | Design-specialist appointment | Quoting a price the bench cannot hit |
| Repair / service | Ticket + drop-off window | Promising same-day without bench capacity |
| After-hours high intent | Book next open slot + SMS | Letting the call die |
| Vendor / press / spam | Short close or transfer | Burning minutes |

## 4. Statuses (portal + CRM)

Use these exact statuses. Do not invent synonyms per client.

- `live` — agent is on the line
- `qualified` — intent + contact captured
- `booked` — calendar write succeeded
- `held` — inventory hold placed
- `escalated` — human must take it
- `follow_up` — callback owed
- `resolved` — closed with no further action
- `no_answer` — outbound / wrap failed
- `blocked` — abuse, fraud, or do-not-call

A call can have one **status** and many **actions**.

## 5. Actions the agent may take

- Book / reschedule / cancel an appointment
- Send SMS or email confirmation
- Create or update a CRM contact
- Place an inventory hold (Nivoda or in-house)
- Flag a human (owner, specialist, bench)
- Capture a plain-English note the staff can read in 10 seconds

If an integration is missing, the agent **says so** and takes the next-best action (message + follow_up). It never pretends a booking landed.

## 6. Escalation (non-negotiable)

Escalate immediately when:

- The caller asks for a human
- Value or complexity is above the client’s threshold (default: custom > $25k or estate)
- The caller is upset, grieving, or reporting a loss/theft
- Legal, warranty, or insurance language is required
- The agent cannot confirm inventory or calendar

Escalation script: acknowledge, take a callback number, state who will call and by when, log `escalated`.

## 7. Guardrails

- Never invent carat, certificate, price, or availability.
- Never store card numbers on the call. Payment links only.
- Never discuss another client’s purchase.
- Never stay on a line that has gone silent for 20 seconds without a check-in.
- Voice clone is opt-in. If clone is not approved, use the house voice.

## 8. After the client signs — developer handover

Handover is a gate, not a Slack thread. The packet is complete only when all of these are filled:

1. Legal name, stores, timezone, hours, holidays
2. Numbers to answer + numbers to display on caller ID
3. Calendar system + which calendars accept bookings
4. CRM + the exact fields we write
5. Inventory source (Nivoda, in-house, none)
6. WhatsApp / SMS / web chat (on or off)
7. Voice: clone source **or** house voice
8. Escalation roster with after-hours owner
9. Scripts: greeting, booking, hold, close
10. Do-not-do list in the client’s own words

Until this packet is marked **ready for build**, engineering does not provision.

## 9. Client onboarding (plain English)

Clients do not fill API forms. They write how the store actually works:

> “We use the iPhone at the front desk, Jane’s Google Calendar for bridal, and we look stones up on Nivoda. After 6 we want texts, not calls to the owner unless it’s over 10k.”

The onboarding flow turns that paragraph into integration cards. Staff can correct a card. Developers receive the structured packet, not the raw ramble — but the raw ramble is stored.

## 10. Ring builder (out of SOP)

The ring studio (Three.js + Draco, GLB from the 3D-app ring, scroll camera, metal/gem build) is a **showroom demo**. It must never:

- replace a live inventory lookup
- be described as “the Fourcee product”
- block answering a call

If a caller is browsing a build, the agent still books the appointment.
