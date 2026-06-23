// ===== APPLICATION DE PROSPECTION IMMOBILIÈRE =====
class ProspectingApp {
    constructor() {
        this.map = null;
        this.markers = [];
        this.points = [];
        this.selectedPoint = null;
        this.addMode = false;
        this.hyeresCords = [43.1240, 6.6308]; // Hyères-les-Palmiers
        
        this.init();
        this.loadData();
        this.checkReminders();
        this.setupNotifications();
    }

    init() {
        // Initialize map with Leaflet
        this.map = L.map('map').setView(this.hyeresCords, 13);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors',
            maxZoom: 19
        }).addTo(this.map);

        // Add click handler for adding points
        this.map.on('click', (e) => {
            if (this.addMode) {
                this.createPoint(e.latlng);
            }
        });

        // Setup navigation buttons
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.switchSection(e.currentTarget.dataset.section);
            });
        });

        // Set today's date in date input
        const today = new Date().toISOString().split('T')[0];
        if (document.getElementById('point-date')) {
            document.getElementById('point-date').value = today;
        }
    }

    switchSection(section) {
        // Update navigation buttons
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-section="${section}"]`).classList.add('active');

        // Update content sections
        document.querySelectorAll('.content-section').forEach(sec => {
            sec.classList.remove('active');
        });
        document.getElementById(`${section}-section`).classList.add('active');

        // Update specific sections content
        if (section === 'history') {
            this.updateHistory();
        } else if (section === 'reminders') {
            this.updateReminders();
        } else if (section === 'stats') {
            this.updateStats();
        }

        // Refresh map size if switching back to map
        if (section === 'map') {
            setTimeout(() => this.map.invalidateSize(), 100);
        }
    }

    createPoint(latlng) {
        const point = {
            id: Date.now(),
            lat: latlng.lat,
            lng: latlng.lng,
            type: 'prospect',
            address: '',
            notes: '',
            date: new Date().toISOString().split('T')[0],
            createdAt: new Date().toISOString(),
            nextFollowUp: this.getNextFollowUpDate(new Date()),
            followed: false
        };

        this.points.push(point);
        this.selectedPoint = point;
        this.showInfoPanel(point);
        this.addMarker(point);
        this.addMode = false;
        document.querySelector('[onclick="app.addPointMode()"]').style.background = '';
        this.showNotification('Point ajouté. Remplissez les détails.', 'info');
    }

    addMarker(point) {
        const colors = {
            prospect: '#2563eb',    // Bleu
            property: '#ea580c',    // Orange
            client: '#16a34a'       // Vert
        };

        const iconHtml = `
            <div style="
                background: ${colors[point.type]};
                width: 32px;
                height: 32px;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                color: white;
                font-weight: bold;
                border: 3px solid white;
                box-shadow: 0 2px 8px rgba(0,0,0,0.3);
                cursor: pointer;
                font-size: 16px;
            ">
                <i class="fas fa-map-pin"></i>
            </div>
        `;

        const marker = L.marker([point.lat, point.lng], {
            icon: L.divIcon({
                html: iconHtml,
                iconSize: [32, 32],
                className: ''
            })
        }).addTo(this.map);

        marker.on('click', () => {
            this.selectedPoint = point;
            this.showInfoPanel(point);
        });

        this.markers.push({ id: point.id, marker });
    }

    showInfoPanel(point) {
        const panel = document.getElementById('info-panel');
        document.getElementById('point-type').value = point.type;
        document.getElementById('point-address').value = point.address;
        document.getElementById('point-notes').value = point.notes;
        document.getElementById('point-date').value = point.date;
        panel.classList.remove('hidden');
    }

    closeInfoPanel() {
        document.getElementById('info-panel').classList.add('hidden');
        this.selectedPoint = null;
    }

    savePoint() {
        if (!this.selectedPoint) return;

        this.selectedPoint.type = document.getElementById('point-type').value;
        this.selectedPoint.address = document.getElementById('point-address').value;
        this.selectedPoint.notes = document.getElementById('point-notes').value;
        this.selectedPoint.date = document.getElementById('point-date').value;
        this.selectedPoint.nextFollowUp = this.getNextFollowUpDate(new Date(this.selectedPoint.date));

        this.saveData();
        this.closeInfoPanel();
        this.showNotification('✅ Point enregistré avec succès!', 'success');

        // Redraw marker with new type
        const markerObj = this.markers.find(m => m.id === this.selectedPoint.id);
        if (markerObj) {
            this.map.removeLayer(markerObj.marker);
        }
        this.markers = this.markers.filter(m => m.id !== this.selectedPoint.id);
        this.addMarker(this.selectedPoint);
    }

    deletePoint() {
        if (!this.selectedPoint) return;

        if (!confirm('Êtes-vous sûr de vouloir supprimer ce point?')) return;

        // Remove from array
        this.points = this.points.filter(p => p.id !== this.selectedPoint.id);

        // Remove marker from map
        const markerObj = this.markers.find(m => m.id === this.selectedPoint.id);
        if (markerObj) {
            this.map.removeLayer(markerObj.marker);
        }
        this.markers = this.markers.filter(m => m.id !== this.selectedPoint.id);

        this.saveData();
        this.closeInfoPanel();
        this.showNotification('🗑️ Point supprimé', 'info');
    }

    addPointMode() {
        this.addMode = !this.addMode;
        const btn = document.querySelector('[onclick="app.addPointMode()"]');
        
        if (this.addMode) {
            this.showNotification('💡 Cliquez sur la carte pour ajouter un point', 'info');
            btn.style.background = 'var(--primary)';
            btn.style.color = 'white';
        } else {
            btn.style.background = '';
            btn.style.color = '';
        }
    }

    getUserLocation() {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const { latitude, longitude } = position.coords;
                    this.map.setView([latitude, longitude], 16);
                    L.circleMarker([latitude, longitude], {
                        radius: 8,
                        fillColor: '#2563eb',
                        color: 'white',
                        weight: 3,
                        opacity: 1,
                        fillOpacity: 0.8
                    }).addTo(this.map);
                    this.showNotification('📍 Localisation trouvée!', 'success');
                },
                () => {
                    this.showNotification('❌ Localisation non autorisée', 'error');
                }
            );
        }
    }

    resetMap() {
        this.map.setView(this.hyeresCords, 13);
    }

    updateHistory() {
        const historyList = document.getElementById('history-list');
        historyList.innerHTML = '';

        const filtered = this.filterPoints();

        if (filtered.length === 0) {
            historyList.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-inbox"></i>
                    <p>Aucun point trouvé</p>
                </div>
            `;
            return;
        }

        filtered.forEach(point => {
            const item = document.createElement('div');
            item.className = 'history-item';
            const date = new Date(point.date);
            const formattedDate = date.toLocaleDateString('fr-FR', { 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
            });

            item.innerHTML = `
                <div class="history-item-content">
                    <div class="history-item-title">${point.address || '📍 Sans adresse'}</div>
                    <div class="history-item-date">📅 ${formattedDate}</div>
                    <div class="history-item-address">${point.notes.substring(0, 60)}${point.notes.length > 60 ? '...' : ''}</div>
                </div>
                <div class="history-item-badge ${point.type}">
                    ${this.getTypeName(point.type)}
                </div>
            `;
            
            item.onclick = () => {
                this.selectedPoint = point;
                this.showInfoPanel(point);
                this.map.setView([point.lat, point.lng], 16);
                this.switchSection('map');
            };
            
            historyList.appendChild(item);
        });
    }

    filterPoints() {
        const search = document.getElementById('search-input').value.toLowerCase();
        const typeFilter = document.getElementById('type-filter').value;

        return this.points.filter(p => {
            const matchesSearch = p.address.toLowerCase().includes(search) ||
                                 p.notes.toLowerCase().includes(search);
            const matchesType = !typeFilter || p.type === typeFilter;
            return matchesSearch && matchesType;
        }).sort((a, b) => new Date(b.date) - new Date(a.date));
    }

    filterHistory() {
        this.updateHistory();
    }

    updateReminders() {
        const remindersList = document.getElementById('reminders-list');
        remindersList.innerHTML = '';

        const today = new Date();
        const reminders = this.points
            .filter(p => {
                const followUpDate = new Date(p.nextFollowUp);
                const daysDiff = Math.floor((today - followUpDate) / (1000 * 60 * 60 * 24));
                return daysDiff >= -7; // Show reminders from now until 7 days before
            })
            .sort((a, b) => new Date(a.nextFollowUp) - new Date(b.nextFollowUp));

        // Update badge count
        document.getElementById('reminder-badge').textContent = reminders.length;

        if (reminders.length === 0) {
            remindersList.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-check-circle"></i>
                    <p>Aucun rappel pour le moment 🎉</p>
                </div>
            `;
            return;
        }

        reminders.forEach(point => {
            const followUpDate = new Date(point.nextFollowUp);
            const daysDiff = Math.floor((today - followUpDate) / (1000 * 60 * 60 * 24));
            const isOverdue = daysDiff > 0;

            const item = document.createElement('div');
            item.className = `reminder-item ${isOverdue ? 'overdue' : ''}`;
            
            let daysText;
            if (isOverdue) {
                daysText = `⚠️ EN RETARD DE ${Math.abs(daysDiff)} JOUR(S)`;
            } else {
                daysText = `⏰ À RELANCER DANS ${Math.abs(daysDiff)} JOUR(S)`;
            }

            item.innerHTML = `
                <div class="reminder-content">
                    <div class="reminder-title">${point.address || 'Sans adresse'}</div>
                    <div class="reminder-date">📅 ${followUpDate.toLocaleDateString('fr-FR')}</div>
                    <div class="reminder-days">${daysText}</div>
                </div>
                <div class="reminder-actions">
                    <button class="reminder-btn" onclick="app.markAsFollowedUp(${point.id})">
                        ✓ Suivi fait
                    </button>
                </div>
            `;
            
            remindersList.appendChild(item);
        });
    }

    markAsFollowedUp(pointId) {
        const point = this.points.find(p => p.id === pointId);
        if (point) {
            point.date = new Date().toISOString().split('T')[0];
            point.nextFollowUp = this.getNextFollowUpDate(new Date());
            point.followed = true;
            this.saveData();
            this.updateReminders();
            this.showNotification('✅ Suivi mis à jour', 'success');
        }
    }

    getNextFollowUpDate(date) {
        const d = new Date(date);
        d.setDate(d.getDate() + 90); // 3 months = ~90 days
        return d.toISOString().split('T')[0];
    }

    updateStats() {
        const today = new Date();
        const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

        const statsToday = this.points.filter(p => {
            const d = new Date(p.date);
            return d.toDateString() === today.toDateString();
        }).length;

        const statsWeek = this.points.filter(p => {
            const d = new Date(p.date);
            return d >= weekAgo;
        }).length;

        const statsPending = this.points.filter(p => {
            const followUpDate = new Date(p.nextFollowUp);
            return followUpDate <= today;
        }).length;

        document.getElementById('stat-total').textContent = this.points.length;
        document.getElementById('stat-today').textContent = statsToday;
        document.getElementById('stat-week').textContent = statsWeek;
        document.getElementById('stat-pending').textContent = statsPending;
    }

    getTypeName(type) {
        const names = {
            'prospect': '🔵 Prospect',
            'property': '🟠 À Vendre',
            'client': '🟢 Client'
        };
        return names[type] || type;
    }

    checkReminders() {
        // Check for reminders every minute
        setInterval(() => {
            const today = new Date();
            this.points.forEach(point => {
                const followUpDate = new Date(point.nextFollowUp);
                const daysDiff = Math.floor((today - followUpDate) / (1000 * 60 * 60 * 24));
                
                // Notify if exactly 90 days have passed
                if (daysDiff === 0 && !point.followed) {
                    this.showNotification(
                        `🔔 RAPPEL: Suivi à faire pour ${point.address}`,
                        'info'
                    );
                    this.sendDesktopNotification(
                        'ProspectMap - Rappel de Suivi',
                        `Relancer le prospect: ${point.address}`
                    );
                }
            });
        }, 60000);
    }

    setupNotifications() {
        // Request notification permission
        if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission();
        }
    }

    sendDesktopNotification(title, message) {
        if ('Notification' in window && Notification.permission === 'granted') {
            new Notification(title, { 
                body: message,
                icon: 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/svgs/solid/map-location-dot.svg'
            });
        }
    }

    showNotification(message, type = 'info') {
        const toast = document.getElementById('notification-toast');
        toast.textContent = message;
        toast.className = `notification-visible notification-${type}`;

        setTimeout(() => {
            toast.classList.remove('notification-visible');
            toast.classList.add('notification-hidden');
        }, 3000);
    }

    saveData() {
        localStorage.setItem('prospectingData', JSON.stringify(this.points));
    }

    loadData() {
        const data = localStorage.getItem('prospectingData');
        if (data) {
            this.points = JSON.parse(data);
            this.points.forEach(point => this.addMarker(point));
            this.updateStats();
        }
    }

    exportData() {
        const dataStr = JSON.stringify(this.points, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `prospection_hyeres_${new Date().toISOString().split('T')[0]}.json`;
        link.click();
        URL.revokeObjectURL(url);
        this.showNotification('📥 Données exportées', 'success');
    }

    importData(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const imported = JSON.parse(e.target.result);
                
                if (!Array.isArray(imported)) {
                    this.showNotification('❌ Format de fichier invalide', 'error');
                    return;
                }

                // Merge with existing data (avoid duplicates by ID)
                const newPoints = imported.filter(ip => 
                    !this.points.find(p => p.id === ip.id)
                );

                this.points.push(...newPoints);
                
                // Clear markers and redraw
                this.markers.forEach(m => this.map.removeLayer(m.marker));
                this.markers = [];
                this.points.forEach(p => this.addMarker(p));
                
                this.saveData();
                this.updateStats();
                this.showNotification(`✅ ${newPoints.length} points importés`, 'success');
            } catch (err) {
                this.showNotification('❌ Erreur lors de l\'import', 'error');
                console.error(err);
            }
        };
        reader.readAsText(file);
        event.target.value = '';
    }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.app = new ProspectingApp();
});
