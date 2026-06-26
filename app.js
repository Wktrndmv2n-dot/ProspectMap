// ===== APPLICATION DE PROSPECTION IMMOBILIÈRE =====
class ProspectingApp {
    constructor() {
        this.map = null;
        this.markers = [];
        this.polylines = [];
        this.points = [];
        this.selectedPoint = null;
        this.selectedPolyline = null;
        this.addMode = false;
        this.drawMode = false;
        this.drawPoints = [];
        this.hyeresCords = [43.1240, 6.6308];
        
        this.init();
        this.loadData();
        this.checkReminders();
        this.setupNotifications();
        this.redrawPolylines();
    }

    init() {
        this.map = L.map('map').setView(this.hyeresCords, 13);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors',
            maxZoom: 19
        }).addTo(this.map);

        this.map.on('click', (e) => {
            if (this.addMode) {
                this.createPoint(e.latlng);
            } else if (this.drawMode) {
                this.addDrawPoint(e.latlng);
            }
        });

        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.switchSection(e.currentTarget.dataset.section);
            });
        });

        const today = new Date().toISOString().split('T')[0];
        if (document.getElementById('point-date')) {
            document.getElementById('point-date').value = today;
        }
    }

    switchSection(section) {
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-section="${section}"]`).classList.add('active');

        document.querySelectorAll('.content-section').forEach(sec => {
            sec.classList.remove('active');
        });
        document.getElementById(`${section}-section`).classList.add('active');

        if (section === 'history') {
            this.updateHistory();
        } else if (section === 'reminders') {
            this.updateReminders();
        } else if (section === 'stats') {
            this.updateStats();
        }

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
        this.showNotification('📌 Point ajouté. Remplissez les détails.', 'info');
    }

    addMarker(point) {
        const colors = {
            prospect: '#2563eb',
            property: '#ea580c',
            client: '#16a34a'
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

        const markerObj = this.markers.find(m => m.id === this.selectedPoint.id);
        if (markerObj) {
            this.map.removeLayer(markerObj.marker);
        }
        this.markers = this.markers.filter(m => m.id !== this.selectedPoint.id);
        this.addMarker(this.selectedPoint);
        
        this.redrawPolylines();
    }

    deletePoint() {
        if (!this.selectedPoint) return;

        if (!confirm('Êtes-vous sûr de vouloir supprimer ce point?')) return;

        const deletedId = this.selectedPoint.id;

        this.points = this.points.filter(p => p.id !== deletedId);

        const markerObj = this.markers.find(m => m.id === deletedId);
        if (markerObj) {
            this.map.removeLayer(markerObj.marker);
        }
        this.markers = this.markers.filter(m => m.id !== deletedId);

        this.polylines = this.polylines.filter(pl => {
            if (pl.pointIds.includes(deletedId)) {
                this.map.removeLayer(pl.polyline);
                return false;
            }
            return true;
        });

        this.saveData();
        this.closeInfoPanel();
        this.showNotification('🗑️ Point supprimé', 'info');
    }

    addPointMode() {
        this.addMode = !this.addMode;
        this.drawMode = false;
        const btn = document.querySelector('[onclick="app.addPointMode()"]');
        
        if (this.addMode) {
            this.showNotification('💡 Cliquez sur la carte pour ajouter un point', 'info');
            btn.style.background = 'var(--primary)';
            btn.style.color = 'white';
            this.map.dragging.disable();
        } else {
            btn.style.background = '';
            btn.style.color = '';
            this.map.dragging.enable();
        }
    }

    drawLineMode() {
        this.drawMode = !this.drawMode;
        this.addMode = false;
        this.drawPoints = [];
        const btn = document.querySelector('[onclick="app.drawLineMode()"]');
        
        if (this.drawMode) {
            this.showNotification('✏️ Cliquez sur la carte pour tracer une ligne.', 'info');
            btn.style.background = 'var(--warning)';
            btn.style.color = 'white';
            this.map.dragging.disable();
        } else {
            btn.style.background = '';
            btn.style.color = '';
            this.map.dragging.enable();
        }
    }

    addDrawPoint(latlng) {
        if (!this.drawMode) return;
        
        this.drawPoints.push(latlng);
        
        L.circleMarker(latlng, {
            radius: 5,
            fillColor: '#ea580c',
            color: 'white',
            weight: 2,
            opacity: 1,
            fillOpacity: 0.8
        }).addTo(this.map);

        this.showNotification(`📍 Point ${this.drawPoints.length} ajouté`, 'info');
    }

    finishLine() {
        if (this.drawPoints.length < 2) {
            this.showNotification('❌ Besoin d\'au moins 2 points', 'error');
            this.drawMode = false;
            const btn = document.querySelector('[onclick="app.drawLineMode()"]');
            btn.style.background = '';
            btn.style.color = '';
            this.map.dragging.enable();
            this.drawPoints = [];
            return;
        }

        this.showLineFormPanel();
    }

    showLineFormPanel() {
        const panel = document.getElementById('line-form-panel');
        if (!panel) {
            const newPanel = document.createElement('div');
            newPanel.id = 'line-form-panel';
            newPanel.className = 'line-form-panel';
            newPanel.innerHTML = `
                <div class="line-form-header">
                    <h3>📅 Détails de la Ligne</h3>
                    <button onclick="app.closeLineFormPanel()" class="btn-close">×</button>
                </div>
                <div class="line-form-content">
                    <div class="form-group">
                        <label>🏠 Adresse/Description:</label>
                        <input type="text" id="line-address" placeholder="Ex: Route de Hyères à Lavandou">
                    </div>
                    <div class="form-group">
                        <label>📅 Date de Visite:</label>
                        <input type="date" id="line-date">
                    </div>
                    <div class="form-group">
                        <label>📋 Notes:</label>
                        <textarea id="line-notes" placeholder="Notes..."></textarea>
                    </div>
                    <button class="btn-primary" onclick="app.saveLineForm()">
                        <i class="fas fa-save"></i> Créer la Ligne
                    </button>
                    <button class="btn-secondary" onclick="app.closeLineFormPanel()">
                        <i class="fas fa-times"></i> Annuler
                    </button>
                </div>
            `;
            document.getElementById('map-section').appendChild(newPanel);
        } else {
            panel.classList.remove('hidden');
        }
        
        document.getElementById('line-date').value = new Date().toISOString().split('T')[0];
        document.getElementById('line-address').value = '';
        document.getElementById('line-notes').value = '';
    }

    closeLineFormPanel() {
        const panel = document.getElementById('line-form-panel');
        if (panel) {
            panel.classList.add('hidden');
        }
        this.drawMode = false;
        this.drawPoints = [];
        const btn = document.querySelector('[onclick="app.drawLineMode()"]');
        btn.style.background = '';
        btn.style.color = '';
        this.map.dragging.enable();
    }

    saveLineForm() {
        const address = document.getElementById('line-address').value;
        const date = document.getElementById('line-date').value;
        const notes = document.getElementById('line-notes').value;

        const nextFollowUp = this.getNextFollowUpDate(new Date(date));
        
        const polylineObj = {
            id: Date.now(),
            coordinates: this.drawPoints,
            pointIds: [],
            date: date,
            nextFollowUp: nextFollowUp,
            address: address,
            notes: notes,
            color: this.getLineColorByDate(date),
            followed: false
        };

        const polyline = L.polyline(this.drawPoints, {
            color: polylineObj.color,
            weight: 4,
            opacity: 0.9
        }).addTo(this.map);

        polyline.on('click', () => {
            this.selectedPolyline = { ...polylineObj, polyline };
            this.showPolylineInfo(this.selectedPolyline);
        });

        this.polylines.push({ ...polylineObj, polyline });
        this.saveData();
        this.closeLineFormPanel();
        this.showNotification('✅ Ligne tracée!', 'success');
    }

    showPolylineInfo(polylineObj) {
        const today = new Date();
        const followUpDate = new Date(polylineObj.nextFollowUp);
        const daysDiff = Math.floor((followUpDate - today) / (1000 * 60 * 60 * 24));
        
        const visitDate = new Date(polylineObj.date);
        const visitDateStr = visitDate.toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric' });
        const followUpDateStr = followUpDate.toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric' });

        let statusText = '';
        let statusColor = '';

        if (daysDiff < 0) {
            statusText = `🔴 EN RETARD DE ${Math.abs(daysDiff)} JOUR(S)`;
            statusColor = '#dc2626';
        } else if (daysDiff <= 15) {
            statusText = `🟠 ALERTE - À RELANCER DANS ${daysDiff} JOUR(S)`;
            statusColor = '#ea580c';
        } else {
            statusText = `🟢 OK - À RELANCER DANS ${daysDiff} JOUR(S)`;
            statusColor = '#16a34a';
        }

        const infoHtml = `
            <div class="polyline-info-panel" style="background: ${statusColor}22; border-left: 4px solid ${statusColor};">
                <div class="polyline-info-header">
                    <h3>📍 ${polylineObj.address || 'Ligne sans adresse'}</h3>
                    <button onclick="app.closePolylineInfo()" class="btn-close">×</button>
                </div>
                <div class="polyline-info-content">
                    <div class="info-row">
                        <span class="info-label">📅 Date de passage:</span>
                        <span class="info-value">${visitDateStr}</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">📅 À repasser le:</span>
                        <span class="info-value">${followUpDateStr}</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">⏰ Statut:</span>
                        <span class="info-value" style="color: ${statusColor}; font-weight: bold;">${statusText}</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">📋 Notes:</span>
                        <span class="info-value">${polylineObj.notes || 'Aucune note'}</span>
                    </div>
                    <button class="btn-primary" onclick="app.markLineFollowedUp(${polylineObj.id})" style="margin-top: 12px;">
                        ✓ Marquer comme suivi fait
                    </button>
                </div>
            </div>
        `;

        const container = document.createElement('div');
        container.innerHTML = infoHtml;
        container.style.position = 'absolute';
        container.style.bottom = '100px';
        container.style.right = '20px';
        container.style.zIndex = '500';
        container.style.maxWidth = '400px';
        
        document.getElementById('map-section').appendChild(container);
        this.polylineInfoContainer = container;
    }

    closePolylineInfo() {
        if (this.polylineInfoContainer) {
            this.polylineInfoContainer.remove();
            this.polylineInfoContainer = null;
        }
        this.selectedPolyline = null;
    }

    markLineFollowedUp(polylineId) {
        const polyline = this.polylines.find(p => p.id === polylineId);
        if (polyline) {
            polyline.date = new Date().toISOString().split('T')[0];
            polyline.nextFollowUp = this.getNextFollowUpDate(new Date());
            polyline.followed = true;
            this.saveData();
            this.redrawPolylines();
            this.closePolylineInfo();
            this.showNotification('✅ Ligne marquée!', 'success');
        }
    }

    getLineColorByDate(date) {
        const today = new Date();
        const visitDate = new Date(date);
        const nextFollowUp = this.getNextFollowUpDate(visitDate);
        const followUpDate = new Date(nextFollowUp);
        const daysDiff = Math.floor((followUpDate - today) / (1000 * 60 * 60 * 24));
        
        if (daysDiff < 0) return '#dc2626';
        if (daysDiff <= 15) return '#ea580c';
        return '#16a34a';
    }

    redrawPolylines() {
        this.polylines.forEach(pl => {
            if (pl.polyline) this.map.removeLayer(pl.polyline);
        });

        this.polylines.forEach(pl => {
            const newColor = this.getLineColorByDate(pl.date);
            const newPolyline = L.polyline(pl.coordinates, {
                color: newColor,
                weight: 4,
                opacity: 0.9
            }).addTo(this.map);

            newPolyline.on('click', () => {
                this.selectedPolyline = { ...pl, polyline: newPolyline };
                this.showPolylineInfo(this.selectedPolyline);
            });
            
            pl.color = newColor;
            pl.polyline = newPolyline;
        });
    }

    clearAllLines() {
        if (!confirm('Êtes-vous sûr?')) return;
        this.polylines.forEach(pl => {
            if (pl.polyline) this.map.removeLayer(pl.polyline);
        });
        this.polylines = [];
        this.saveData();
        this.showNotification('🗑️ Lignes supprimées', 'info');
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
                    this.showNotification('📍 Localisation!', 'success');
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

        const allItems = [];

        const filteredPoints = this.filterPoints();
        filteredPoints.forEach(point => {
            allItems.push({
                type: 'point',
                data: point,
                date: new Date(point.date)
            });
        });

        const search = document.getElementById('search-input').value.toLowerCase();
        this.polylines
            .filter(pl => pl.address.toLowerCase().includes(search) || pl.notes.toLowerCase().includes(search))
            .forEach(polyline => {
                allItems.push({
                    type: 'polyline',
                    data: polyline,
                    date: new Date(polyline.date)
                });
            });

        allItems.sort((a, b) => b.date - a.date);

        if (allItems.length === 0) {
            historyList.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-inbox"></i>
                    <p>Aucun élément</p>
                </div>
            `;
            return;
        }

        allItems.forEach(item => {
            if (item.type === 'point') {
                const point = item.data;
                const itemElement = document.createElement('div');
                itemElement.className = 'history-item';
                const date = new Date(point.date);
                const formattedDate = date.toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric' });

                itemElement.innerHTML = `
                    <div class="history-item-content">
                        <div class="history-item-title">📍 ${point.address || 'Sans adresse'}</div>
                        <div class="history-item-date">📅 ${formattedDate}</div>
                        <div class="history-item-address">${point.notes.substring(0, 60)}</div>
                    </div>
                    <div class="history-item-badge ${point.type}">
                        ${this.getTypeName(point.type)}
                    </div>
                `;
                
                itemElement.onclick = () => {
                    this.selectedPoint = point;
                    this.showInfoPanel(point);
                    this.map.setView([point.lat, point.lng], 16);
                    this.switchSection('map');
                };
                
                historyList.appendChild(itemElement);

            } else if (item.type === 'polyline') {
                const polyline = item.data;
                const itemElement = document.createElement('div');
                itemElement.className = 'history-item';
                const date = new Date(polyline.date);
                const formattedDate = date.toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric' });

                const today = new Date();
                const followUpDate = new Date(polyline.nextFollowUp);
                const daysDiff = Math.floor((followUpDate - today) / (1000 * 60 * 60 * 24));
                
                let badgeColor = 'line-green';
                let badgeText = '🟢 OK';
                if (daysDiff < 0) {
                    badgeColor = 'line-red';
                    badgeText = '🔴 Retard';
                } else if (daysDiff <= 15) {
                    badgeColor = 'line-orange';
                    badgeText = '🟠 Alerte';
                }

                itemElement.innerHTML = `
                    <div class="history-item-content">
                        <div class="history-item-title">📍 ${polyline.address || 'Ligne sans nom'}</div>
                        <div class="history-item-date">📅 ${formattedDate}</div>
                        <div class="history-item-address">À repasser: ${followUpDate.toLocaleDateString('fr-FR')}</div>
                    </div>
                    <div class="history-item-badge ${badgeColor}">
                        ${badgeText}
                    </div>
                `;
                
                itemElement.onclick = () => {
                    this.selectedPolyline = polyline;
                    this.showPolylineInfo(polyline);
                    this.switchSection('map');
                };
                
                historyList.appendChild(itemElement);
            }
        });
    }

    filterPoints() {
        const search = document.getElementById('search-input').value.toLowerCase();
        const typeFilter = document.getElementById('type-filter').value;

        return this.points.filter(p => {
            const matchesSearch = p.address.toLowerCase().includes(search) || p.notes.toLowerCase().includes(search);
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
                return daysDiff >= -7;
            })
            .sort((a, b) => new Date(a.nextFollowUp) - new Date(b.nextFollowUp));

        document.getElementById('reminder-badge').textContent = reminders.length;

        if (reminders.length === 0) {
            remindersList.innerHTML = `<div class="empty-state"><i class="fas fa-check-circle"></i><p>Aucun rappel 🎉</p></div>`;
            return;
        }

        reminders.forEach(point => {
            const followUpDate = new Date(point.nextFollowUp);
            const daysDiff = Math.floor((today - followUpDate) / (1000 * 60 * 60 * 24));
            const isOverdue = daysDiff > 0;

            const item = document.createElement('div');
            item.className = `reminder-item ${isOverdue ? 'overdue' : ''}`;
            
            let daysText, colorIndicator;
            if (isOverdue) {
                daysText = `EN RETARD DE ${Math.abs(daysDiff)} JOUR(S)`;
                colorIndicator = '🔴';
            } else if (daysDiff <= 15 && daysDiff >= 0) {
                daysText = `À RELANCER DANS ${Math.abs(daysDiff)} JOUR(S)`;
                colorIndicator = '🟠';
            } else {
                daysText = `À RELANCER DANS ${Math.abs(daysDiff)} JOUR(S)`;
                colorIndicator = '🟢';
            }

            item.innerHTML = `
                <div class="reminder-content">
                    <div class="reminder-title">${point.address || 'Sans adresse'}</div>
                    <div class="reminder-date">📅 ${followUpDate.toLocaleDateString('fr-FR')}</div>
                    <div class="reminder-days">${colorIndicator} ${daysText}</div>
                </div>
                <div class="reminder-actions">
                    <button class="reminder-btn" onclick="app.markAsFollowedUp(${point.id})">✓ Suivi</button>
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
            this.redrawPolylines();
            this.showNotification('✅ Suivi mis à jour', 'success');
        }
    }

    getNextFollowUpDate(date) {
        const d = new Date(date);
        d.setDate(d.getDate() + 90);
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
        const names = {'prospect': '🔵 Prospect', 'property': '🟠 À Vendre', 'client': '🟢 Client'};
        return names[type] || type;
    }

    checkReminders() {
        setInterval(() => {
            const today = new Date();
            this.points.forEach(point => {
                const followUpDate = new Date(point.nextFollowUp);
                const daysDiff = Math.floor((today - followUpDate) / (1000 * 60 * 60 * 24));
                
                if (daysDiff === 0 && !point.followed) {
                    this.showNotification(`🔔 RAPPEL: Suivi pour ${point.address}`, 'info');
                    this.sendDesktopNotification('ProspectMap - Rappel', `Relancer: ${point.address}`);
                }
            });
            
            this.redrawPolylines();
        }, 60000);
    }

    setupNotifications() {
        if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission();
        }
    }

    sendDesktopNotification(title, message) {
        if ('Notification' in window && Notification.permission === 'granted') {
            new Notification(title, { body: message });
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
        const dataToSave = {
            points: this.points,
            polylines: this.polylines.map(pl => ({
                id: pl.id,
                coordinates: pl.coordinates,
                pointIds: pl.pointIds,
                color: pl.color,
                date: pl.date,
                nextFollowUp: pl.nextFollowUp,
                address: pl.address,
                notes: pl.notes,
                followed: pl.followed
            }))
        };
        localStorage.setItem('prospectingData', JSON.stringify(dataToSave));
    }

    loadData() {
        const data = localStorage.getItem('prospectingData');
        if (data) {
            try {
                const parsed = JSON.parse(data);
                
                if (Array.isArray(parsed)) {
                    this.points = parsed;
                    this.polylines = [];
                } else {
                    this.points = parsed.points || [];
                    this.polylines = parsed.polylines || [];
                }
                
                this.points.forEach(point => this.addMarker(point));
                this.redrawPolylines();
                this.updateStats();
            } catch (e) {
                console.error('Error:', e);
            }
        }
    }

    exportData() {
        const dataStr = JSON.stringify({ 
            points: this.points, 
            polylines: this.polylines.map(pl => ({
                id: pl.id,
                coordinates: pl.coordinates,
                pointIds: pl.pointIds,
                color: pl.color,
                date: pl.date,
                nextFollowUp: pl.nextFollowUp,
                address: pl.address,
                notes: pl.notes,
                followed: pl.followed
            }))
        }, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `prospection_${new Date().toISOString().split('T')[0]}.json`;
        link.click();
        URL.revokeObjectURL(url);
        this.showNotification('📥 Exporté', 'success');
    }

    importData(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const imported = JSON.parse(e.target.result);
                
                let importedPoints = [];
                let importedPolylines = [];

                if (Array.isArray(imported)) {
                    importedPoints = imported;
                } else {
                    importedPoints = imported.points || [];
                    importedPolylines = imported.polylines || [];
                }

                const newPoints = importedPoints.filter(ip => !this.points.find(p => p.id === ip.id));
                this.points.push(...newPoints);
                this.polylines.push(...importedPolylines.filter(ip => !this.polylines.find(p => p.id === ip.id)));
                
                this.markers.forEach(m => this.map.removeLayer(m.marker));
                this.markers = [];
                this.polylines.forEach(pl => {
                    if (pl.polyline) this.map.removeLayer(pl.polyline);
                });
                
                this.points.forEach(p => this.addMarker(p));
                this.redrawPolylines();
                
                this.saveData();
                this.updateStats();
                this.showNotification(`✅ ${newPoints.length} importés`, 'success');
            } catch (err) {
                this.showNotification('❌ Erreur import', 'error');
            }
        };
        reader.readAsText(file);
        event.target.value = '';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.app = new ProspectingApp();
});
