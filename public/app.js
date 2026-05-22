// Local cache state to hold profiles dynamically
let currentProfiles = [];

document.addEventListener('DOMContentLoaded', () => {
    fetchProfiles();
    document.getElementById('btn-sync').addEventListener('click', scanStatuses);
    document.getElementById('btn-add').addEventListener('click', addProfile);
    document.getElementById('btn-open-active').addEventListener('click', openActiveProfiles);
});

async function fetchProfiles() {
    const res = await fetch('/api/profiles');
    currentProfiles = await res.json();
    renderTable(currentProfiles, false);
}

function renderTable(profiles, hasStatusData = false, scanningAll = false) {
    const tbody = document.getElementById('profiles-tbody');
    tbody.innerHTML = '';

    if (profiles.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding: 40px; color: #a0aec0;">Няма конфигурирани акаунти. Добавете нов профил по-долу.</td></tr>`;
        return;
    }

    profiles.forEach(p => {
        let statusHtml = `<span class="status-badge status-unknown">Непроверен</span>`;
        let unreadHtml = `<span style="color: #a0aec0;">—</span>`;

        if (scanningAll) {
            statusHtml = `<span class="status-badge status-scanning">⏳ Проверява се...</span>`;
            unreadHtml = `<span style="color: #a0aec0; font-style: italic;">Изчакване</span>`;
        } else if (hasStatusData) {
            if (p.status === 'Logged Out') {
                statusHtml = `<span class="status-badge status-logout"> Излязъл (Sign-out)</span>`;
                unreadHtml = `<span style="color: var(--danger); font-weight:600;">Недостъпно</span>`;
            } else if (p.status === 'Active') {
                statusHtml = `<span class="status-badge status-active">Активна сесия</span>`;
                unreadHtml = p.unreadCount > 0 ? `<span class="message-badge">${p.unreadCount} нови</span>` : `0 съобщения`;
            } else {
                statusHtml = `<span class="status-badge status-logout">Грешка в мрежата</span>`;
                unreadHtml = `—`;
            }
        }

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>#${p.id}</td>
            <td>
                <div class="name-container">
                    <strong id="profile-name-${p.id}">${p.name}</strong>
                    <button class="btn-inline-edit" onclick="editProfileName(${p.id})">✏️</button>
                </div>
            </td>
            <td>${statusHtml}</td>
            <td>${unreadHtml}</td>
            <td style="text-align: right;">
                <button class="btn-action" onclick="openProfile(${p.id})">🌐 Отвори</button>
                <button class="btn-danger" onclick="deleteProfile(${p.id})">🗑️</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

async function scanStatuses() {
    // Instantly switch all row indicators to show progress is happening
    renderTable(currentProfiles, false, true);

    try {
        const res = await fetch('/api/status');
        currentProfiles = await res.json();
        renderTable(currentProfiles, true);
    } catch(e) {
        alert("Грешка при комуникация със сървъра.");
        fetchProfiles();
    }
}

async function editProfileName(id) {
    const nameElement = document.getElementById(`profile-name-${id}`);
    const currentName = nameElement.innerText;

    const newName = prompt("Въведете ново име за профила:", currentName);
    if (newName === null) return; // Cancel hit
    if (!newName.trim()) return alert("Името не може да бъде празно!");

    try {
        const res = await fetch(`/api/profiles/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: newName })
        });
        const data = await res.json();
        if (data.success) {
            fetchProfiles(); // Refresh visual setup
        } else {
            alert("Неуспешно редактиране.");
        }
    } catch(e) {
        alert("Възникна грешка при обновяването на името.");
    }
}

async function openProfile(id) {
    await fetch(`/api/open/${id}`, { method: 'POST' });
}

async function openActiveProfiles() {
    const res = await fetch('/api/open-active', { method: 'POST' });
    const data = await res.json();
    alert(`Операцията приключи! Стартирани прозорци за активни профили с нови съобщения: ${data.count}`);
}

async function addProfile() {
    const input = document.getElementById('new-profile-name');
    const name = input.value;
    if (!name.trim()) return;

    const res = await fetch('/api/profiles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name })
    });
    const data = await res.json();
    if (data.success) {
        input.value = '';
        fetchProfiles();
    }
}

async function deleteProfile(id) {
    if (!confirm('Сигурни ли сте, че искате да изтриете този профил и кеш данните му от диска?')) return;

    const res = await fetch(`/api/profiles/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.success) {
        fetchProfiles();
    }
}