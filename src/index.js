export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    if (url.pathname === "/members") {
      return getMembers(env, corsHeaders);
    }

    if (url.pathname === "/submit" && request.method === "POST") {
      return submitToMonday(request, env, corsHeaders);
    }

    return new Response(renderPage(env), {
      headers: { "Content-Type": "text/html;charset=UTF-8" }
    });
  }
};

async function mondayRequest(env, query, variables = {}) {
  const mondayApiToken = getMondayApiToken(env);

  const response = await fetch("https://api.monday.com/v2", {
    method: "POST",
    headers: {
      Authorization: mondayApiToken,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ query, variables })
  });

  const data = await response.json();

  if (data.errors) {
    throw new Error(JSON.stringify(data.errors));
  }

  return data;
}

function getMondayApiToken(env) {
  const token = env.Monday_Central_API_TOKEN || env.MONDAY_API_TOKEN;

  if (!token) {
    throw new Error("Missing Monday.com API token binding.");
  }

  return token;
}

async function getMembers(env, headers) {
  try {
    const query = `
      query ($boardId: [ID!]) {
        boards(ids: $boardId) {
          items_page(limit: 500) {
            items {
              id
              name
              column_values(ids: ["color_mkw1xfh2", "pulse_id_mm34sv67"]) {
                id
                text
              }
            }
          }
        }
      }
    `;

    const data = await mondayRequest(env, query, {
      boardId: [String(env.MEMBERS_BOARD_ID)]
    });

    const allowedMemberships = [
      "General Membership(Retail + CoLab)",
      "Key Holder",
      "CoLab Only Membership"
    ];

    const items = data.data.boards?.[0]?.items_page?.items || [];

    const members = items
      .filter((item) => {
        const membership = item.column_values.find(
          (c) => c.id === "color_mkw1xfh2"
        )?.text;

        return allowedMemberships.includes(membership);
      })
      .map((item) => {
        const nameParts = item.name.trim().split(/\s+/);
        const firstName = nameParts[0] || "Member";
        const lastInitial =
          nameParts.length > 1
            ? `${nameParts[nameParts.length - 1].charAt(0)}.`
            : "";

        const memberIdColumn = item.column_values.find(
          (c) => c.id === "pulse_id_mm34sv67"
        )?.text;

        return {
          label: `${firstName} ${lastInitial}`.trim(),
          memberItemId: item.id,
          memberId: memberIdColumn || item.id
        };
      })
      .sort((a, b) => a.label.localeCompare(b.label));

    return jsonResponse(members, headers);
  } catch (error) {
    return jsonResponse({ error: error.message }, headers, 500);
  }
}

async function submitToMonday(request, env, headers) {
  try {
    const body = await request.json();

    const {
      mode,
      person,
      email,
      memberId,
      activityType,
      activityDescription,
      feedback,
      isMember
    } = body;
    
    const isGuestPass = mode === "guest";

    const cleanPerson = person?.trim() || "Unknown";
    const cleanActivityType = activityType || "Guest Pass";

    const itemName = isGuestPass
      ? `Guest Pass - ${cleanPerson}`
      : `${cleanActivityType} - ${cleanPerson}`;

    const personValue = isGuestPass
      ? `${cleanPerson} | Guest`
      : `${cleanPerson} | Member ID: ${memberId || "Not listed"}`;

    const columnValues = {
      text_mm34jrzj: personValue,
      single_select7pl9kuz: isMember ? "Yes" : "No",
      single_selectis1ajb9: cleanActivityType,
      long_text3mhw34i5: activityDescription || "",
      long_texta8lzlxn7: feedback || "",
      color_mm1rha8b: { label: "New" }
    };

    if (email) {
      columnValues.email_mkrh6fvx = {
        email,
        text: email
      };
    }
    
    const mutation = `
    mutation ($boardId: ID!, $itemName: String!, $columnValues: JSON!) {
    create_item(
    board_id: $boardId,
    item_name: $itemName,
    column_values: $columnValues
    ) {
      id
    }
  }
`;

const result = await mondayRequest(env, mutation, {
  boardId: String(env.FEEDBACK_BOARD_ID),
  itemName,
  columnValues: JSON.stringify(columnValues)
});

    return jsonResponse({ ok: true, result }, headers);
  } catch (error) {
    return jsonResponse({ ok: false, error: error.message }, headers, 500);
  }
}

function jsonResponse(data, headers, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...headers,
      "Content-Type": "application/json"
    }
  });
}

function renderPage(env) {
  const donationUrl = env.DONATION_URL || "https://queerlective.com";

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>CoLab Activity Station</title>
<style>
  body {
    margin: 0;
    font-family: Arial, sans-serif;
    background: #101010;
    color: #fff;
  }

  .wrap {
    max-width: 760px;
    margin: 0 auto;
    padding: 24px;
  }

  h1 {
    font-size: 2.4rem;
    margin-bottom: 8px;
  }

  p {
    line-height: 1.5;
  }

  .card {
    background: #1c1c1c;
    border: 1px solid #333;
    border-radius: 22px;
    padding: 24px;
    margin: 18px 0;
    box-shadow: 0 8px 24px rgba(0,0,0,.25);
  }

  .grid {
    display: grid;
    gap: 14px;
  }

  button {
    width: 100%;
    border: 0;
    border-radius: 18px;
    padding: 20px;
    font-size: 1.15rem;
    font-weight: 700;
    cursor: pointer;
    background: #f4f4f4;
    color: #111;
  }

  button.alt {
    background: #242424;
    color: #fff;
    border: 1px solid #555;
  }

  button.danger {
    background: #ffefef;
  }

  input, select, textarea {
    width: 100%;
    box-sizing: border-box;
    padding: 16px;
    margin-top: 12px;
    border-radius: 14px;
    border: 1px solid #444;
    background: #111;
    color: #fff;
    font-size: 1rem;
  }

  textarea {
    min-height: 110px;
  }

  .qr {
    display: block;
    margin: 22px auto;
    max-width: 320px;
    width: 80%;
    background: white;
    padding: 14px;
    border-radius: 18px;
  }

  .small {
    font-size: .92rem;
    color: #ccc;
  }

  .hidden {
    display: none;
  }
</style>
</head>
<body>
<div class="wrap">
  <h1>CoLab Activity Station</h1>
  <p class="small">Log your visit, share feedback, or submit a guest pass.</p>

  <div id="home" class="card grid">
    <button onclick="showMemberForm()">Member Check-In / Activity Log</button>
    <button onclick="showGuestForm()">Guest Pass</button>
    <button onclick="showFeedbackForm()">Feedback / Request</button>
  </div>

  <div id="formArea"></div>
</div>

<script>
let members = [];
let resetTimer = null;

const donationUrl = ${JSON.stringify(donationUrl)};

function setResetTimer(seconds = 60) {
  clearTimeout(resetTimer);
  resetTimer = setTimeout(resetHome, seconds * 1000);
}

function resetHome() {
  document.getElementById("formArea").innerHTML = "";
  document.getElementById("home").classList.remove("hidden");
}

async function loadMembers() {
  try {
    const res = await fetch("/members");
    members = await res.json();
  } catch (e) {
    members = [];
  }
}

function memberSelect() {
  const options = members.map(m =>
    '<option value="' + escapeHtml(m.label) + '" data-id="' + escapeHtml(m.memberId) + '">' +
    escapeHtml(m.label) +
    '</option>'
  ).join("");

  return \`
    <select id="person">
      <option value="">Select your name</option>
      \${options}
      <option value="Not Listed" data-id="Not Listed">I am not listed</option>
    </select>
  \`;
}

function showMemberForm() {
  document.getElementById("home").classList.add("hidden");
  document.getElementById("formArea").innerHTML = \`
    <div class="card">
      <h2>Member Activity</h2>
      \${memberSelect()}

      <select id="activityType">
        <option>Hosting</option>
        <option>Check In</option>
        <option>Mopped/Sweeped</option>
        <option>Organized(Specify below)</option>
        <option>Cleaned Tables</option>
        <option>Reset Entry Table</option>
        <option>Took Out Trash</option>
        <option>Other</option>
      </select>

      <textarea id="activityDescription" placeholder="What did you work on, clean, organize, or use today?"></textarea>

      <button onclick="submitMember()">Submit</button>
      <button class="alt" onclick="resetHome()">Back</button>
    </div>
  \`;
  setResetTimer();
}

function showGuestForm() {
  document.getElementById("home").classList.add("hidden");
  document.getElementById("formArea").innerHTML = \`
    <div class="card">
      <h2>Guest Pass</h2>

      <input id="guestName" placeholder="Your name">
      <input id="guestEmail" placeholder="Your email">
      <textarea id="guestDescription" placeholder="What are you using the space for today?"></textarea>

      <button onclick="submitGuest()">Submit Guest Pass</button>
      <button class="alt" onclick="resetHome()">Back</button>
    </div>
  \`;
  setResetTimer();
}

function showFeedbackForm() {
  document.getElementById("home").classList.add("hidden");
  document.getElementById("formArea").innerHTML = \`
    <div class="card">
      <h2>Feedback / Request</h2>
      \${memberSelect()}

      <textarea id="feedback" placeholder="What can we do better? What do you need?"></textarea>

      <button onclick="submitFeedback()">Submit Feedback</button>
      <button class="alt" onclick="resetHome()">Back</button>
    </div>
  \`;
  setResetTimer();
}

async function submitMember() {
  const select = document.getElementById("person");
  const selected = select.options[select.selectedIndex];

  if (!select.value) {
    alert("Please select your name.");
    return;
  }

  await postSubmission({
    mode: "member",
    person: select.value,
    memberId: selected.dataset.id,
    isMember: true,
    email: "",
    activityType: document.getElementById("activityType").value,
    activityDescription: document.getElementById("activityDescription").value,
    feedback: ""
  });

  showSuccess("Thank you! Your activity has been logged.");
}

async function submitGuest() {
  const name = document.getElementById("guestName").value.trim();
  const email = document.getElementById("guestEmail").value.trim();

  if (!name || !email) {
    alert("Please enter your name and email.");
    return;
  }

  await postSubmission({
    mode: "guest",
    person: name,
    memberId: "",
    isMember: false,
    email,
    activityType: "Other",
    activityDescription: document.getElementById("guestDescription").value,
    feedback: ""
  });

  showDonationQR();
}

async function submitFeedback() {
  const select = document.getElementById("person");
  const selected = select.options[select.selectedIndex];

  if (!select.value) {
    alert("Please select your name.");
    return;
  }

  await postSubmission({
    mode: "feedback",
    person: select.value,
    memberId: selected.dataset.id,
    isMember: true,
    email: "",
    activityType: "Other",
    activityDescription: "",
    feedback: document.getElementById("feedback").value
  });

  showSuccess("Thank you! Your feedback has been logged.");
}

async function postSubmission(payload) {
  const res = await fetch("/submit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  const data = await res.json();

  if (!data.ok) {
    alert("Something went wrong. Please tell a CoLab admin.");
    console.error(data);
  }
}

function showSuccess(message) {
  document.getElementById("formArea").innerHTML = \`
    <div class="card">
      <h2>\${message}</h2>
      <button onclick="resetHome()">Done</button>
    </div>
  \`;
  setResetTimer(8);
}

function showDonationQR() {
  const qr = "https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=" + encodeURIComponent(donationUrl);

  document.getElementById("formArea").innerHTML = \`
    <div class="card" style="text-align:center;">
      <h2>Thanks for visiting CoLab!</h2>
      <p>Please scan this QR code to complete your day pass donation.</p>
      <img class="qr" src="\${qr}" alt="Donation QR code">
      <p class="small">You may also receive donation info by email.</p>
      <button onclick="resetHome()">Done</button>
    </div>
  \`;
  setResetTimer(30);
}

function escapeHtml(str) {
  return String(str || "").replace(/[&<>"']/g, function(match) {
    return ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    })[match];
  });
}

loadMembers();
</script>
</body>
</html>`;
}
