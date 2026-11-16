# checkout-simple-approval

Click-through prototype for a **Shareable Cart Link**. B2B buyers who lack sign-off authority can request approval for their active Conrad cart directly on the platform, instead of sending screenshots or PDFs.

Static HTML/CSS/JS, no backend. Shared state lives in `localStorage`, so open the pages in separate tabs of the **same browser** and they stay in sync.

## Run

```bash
python3 -m http.server 8000
```

Then open http://localhost:8000.

## Pages

| Page | Role | Purpose |
|------|------|---------|
| `index.html` | Buyer | Cart, "Freigabe anfordern", status banner |
| `freigabe.html?token=…` | Approver | Read-only live cart, approve or reject with a message |
| `email.html` | Buyer | Mock inbox with the notification email |
| `checkout-step1.html` | Buyer | Checkout stub and order confirmation |

The pill bar at the bottom moves between the buyer pages and resets the demo.

## Demo script

1. **Generate a link.** In the cart, click *Freigabe anfordern*, add a note, then *Link erstellen*. Copy the link or use the E-Mail, Teams or WhatsApp shortcuts.
2. **Read-only approver view.** Open the link in a second tab (or use *Ansicht der freigebenden Person öffnen*). It has no quantity controls, no delete and no add-items. Change a quantity in the cart tab and the approver tab updates live, with the changed line highlighted.
3. **Approve or reject.** Enter a name and an optional message, then *Freigeben* or *Ablehnen*.
4. **Buyer notification.** The mail icon in the header gets a badge. `email.html` shows the email with the result, the message and a cart summary.
5. **Check out.** The cart shows a green "Freigegeben von …" banner. *Weiter zur Kasse*, then *Zahlungspflichtig bestellen*. The approver never places the order.
6. **Changes after approval.** After approval, change a quantity. An amber banner offers *Trotzdem zur Kasse* or *Neue Freigabe anfordern*. Checkout is never blocked.

Edge states: *Anfrage zurückziehen* invalidates the link ("Anfrage zurückgezogen"). An unknown token shows "Link ungültig oder abgelaufen". Links are valid for 14 days.
