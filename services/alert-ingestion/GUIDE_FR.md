# Service d'Ingestion d'Alertes - Guide de Déploiement

## 🎯 Résumé de l'Implémentation

Un pipeline complet d'ingestion d'alertes Prometheus a été implémenté avec :
- **Vérification des alertes** (8 critères de validation)
- **Normalisation des alertes** (format standardisé)
- **Gestion de files Redis** (4 files séparées)
- **Logique de réessai automatique** (nombre de tentatives configurable)
- **Monitoring complet** (métriques Prometheus)

---

## 📝 Fichiers de Documentation

Tous les fichiers sont en **anglais** comme demandé :

1. **QUICKSTART.md** - Guide de démarrage rapide (5 minutes)
2. **IMPLEMENTATION.md** - Documentation technique complète
3. **MODIFICATIONS.md** - Liste détaillée de tous les changements
4. **ARCHITECTURE.md** - Vue d'ensemble de l'architecture
5. **README_CHANGES.md** - Résumé des changements

---

## 🔄 Flux de Traitement des Alertes

```
Prometheus (génère alertes)
    ↓
Alertmanager (route et groupe)
    ↓
Webhook POST → /api/prometheus/webhook
    ↓
[VÉRIFICATION] - 8 critères de validation
    ↓
[File Raw] - Stockage temporaire dans Redis
    ↓
[NORMALISATION] - Transformation au format standard
    ↓
┌─────────────┴─────────────┐
↓                           ↓
[File Success]         [File Retry]
    ↓                       ↓
[Corrélation]      (3 tentatives max)
                            ↓
                    [File Error]
```

---

## 🔍 Critères de Vérification des Alertes

Une alerte doit passer **8 vérifications** :

1. ✅ **Champ status présent**
2. ✅ **Status = "firing"** (pas "resolved")
3. ✅ **Labels valides** (objet présent)
4. ✅ **Alertname présent** dans les labels
5. ✅ **Severity présente** (ou priority)
6. ✅ **Severity valide** (critical, high, warning, info)
7. ✅ **Timestamp valide** (format ISO)
8. ✅ **Annotations présentes** avec message/summary/description

### Mapping de Severity

```javascript
'critical' → 'critical'
'high'     → 'high'
'warning'  → 'warning'
'info'     → 'info'
'page'     → 'critical'  // Alias
'urgent'   → 'high'      // Alias
'low'      → 'info'      // Alias
```

---

## 📊 Format de Normalisation

### Entrée (Format Prometheus)
```json
{
  "status": "firing",
  "labels": {
    "alertname": "HighMemoryUsage",
    "severity": "high",
    "instance": "api-server-03",
    "environment": "production",
    "team": "platform"
  },
  "annotations": {
    "summary": "Memory usage above 85% for 5 minutes"
  },
  "startsAt": "2026-02-09T14:30:00Z",
  "fingerprint": "abc123"
}
```

### Sortie (Format Normalisé) ✅
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "service": "api-server-03",
  "severity": "high",
  "message": "Memory usage above 85% for 5 minutes",
  "timestamp": "2026-02-09T14:30:00Z",
  "labels": {
    "alertname": "HighMemoryUsage",
    "environment": "production",
    "team": "platform"
  },
  "source": "prometheus"
}
```

---

## 🗂️ Gestion des Files Redis

### 4 Files Distinctes

| File | Objectif | Logique de Réessai |
|------|----------|-------------------|
| **raw-alerts** | Alertes non vérifiées | Aucun |
| **success-alerts** | Alertes normalisées avec succès | Aucun |
| **retry-alerts** | Échecs de normalisation | 3 tentatives, délai 5s |
| **error-alerts** | Échecs permanents | Aucun |

### Traitement des Erreurs

**Échec de Vérification** → **File Error** (immédiat)

**Échec de Normalisation** → **File Retry** (jusqu'à 3 fois) → **File Error**

---

## 🚀 Démarrage Rapide

### Étape 1 : Installation des Dépendances
```bash
cd services/alert-ingestion
npm install
```

### Étape 2 : Démarrage des Services
```bash
# Retour à la racine du projet
cd ../..

# Démarrer tous les services
docker-compose up -d
```

### Étape 3 : Vérification
```bash
# Vérifier Redis
docker exec -it redis redis-cli ping
# Résultat attendu : PONG

# Vérifier Alert Ingestion
curl http://localhost:8001/health
# Résultat attendu : {"status":"ok"}

# Vérifier Prometheus
curl http://localhost:9090/-/healthy

# Vérifier Alertmanager
curl http://localhost:9093/-/healthy
```

### Étape 4 : Test du Webhook
```bash
curl -X POST http://localhost:8001/api/prometheus/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "version": "4",
    "status": "firing",
    "alerts": [{
      "status": "firing",
      "labels": {
        "alertname": "HighMemoryUsage",
        "severity": "high",
        "instance": "api-server-03",
        "environment": "production",
        "team": "platform"
      },
      "annotations": {
        "summary": "Memory usage above 85% for 5 minutes"
      },
      "startsAt": "2026-02-09T14:30:00Z",
      "fingerprint": "test-123"
    }]
  }'
```

### Étape 5 : Consulter les Statistiques
```bash
curl http://localhost:8001/api/prometheus/stats
```

Résultat attendu :
```json
{
  "processed": 1,
  "verified": 1,
  "normalized": 1,
  "retried": 0,
  "errors": 0,
  "queues": {
    "raw": "raw-alerts",
    "success": "success-alerts",
    "retry": "retry-alerts",
    "error": "error-alerts"
  }
}
```

---

## 📁 Fichiers Modifiés

### 1. `package.json`
**Ajout de dépendances :**
- `redis: ^4.6.12` - Client Redis pour Node.js
- `bull: ^4.12.0` - Gestion de files avec Redis

### 2. `src/config.js`
**Ajout de configuration :**
- `redisUrl` - URL de connexion Redis
- `prometheusUrl` - URL de Prometheus
- `normalization.maxRetries` - Nombre max de tentatives (3)
- `normalization.retryDelayMs` - Délai entre tentatives (5000ms)

### 3. `src/server.js`
**Modifications :**
- Ajout de la route `/api/prometheus`
- Initialisation du processeur d'alertes
- Log de l'URL du webhook

### 4. `src/metrics.js`
**Nouvelles métriques ajoutées :**
- `alerts_verified_total` - Alertes vérifiées
- `alerts_normalized_total` - Alertes normalisées
- `alerts_queued_total` - Alertes en file
- `alerts_retried_total` - Alertes réessayées
- `alerts_failed_total` - Alertes échouées

### 5. `docker-compose.yml`
**Services ajoutés :**
- **Redis** (port 6379) - Stockage des files
- **Alertmanager** (port 9093) - Routage d'alertes

**Volumes ajoutés :**
- `redis_data` - Données Redis persistantes
- `alertmanager_data` - Données Alertmanager

### 6. `monitoring/prometheus/prometheus.yml`
**Configuration ajoutée :**
- Section `alerting` avec cible Alertmanager
- Section `rule_files` pour charger alerts.yml

---

## 📦 Nouveaux Fichiers Créés

### Services (4 fichiers)

1. **src/queue/redisQueue.js**
   - Gestionnaire de files Redis
   - 4 files avec Bull
   - Écouteurs d'événements
   - Arrêt gracieux

2. **src/services/verificationService.js**
   - Vérification des alertes
   - 8 critères de validation
   - Mapping de severity
   - Extraction du nom de service

3. **src/services/normalizationService.js**
   - Normalisation au format standard
   - Génération d'ID unique
   - Validation de structure
   - Préservation des données brutes

4. **src/services/alertProcessor.js**
   - Orchestrateur du pipeline
   - Traitement des files
   - Logique de réessai
   - Statistiques de traitement

### Routes (1 fichier)

5. **src/routes/prometheus.js**
   - `POST /api/prometheus/webhook` - Reception d'alertes
   - `GET /api/prometheus/stats` - Statistiques
   - `GET /api/prometheus/test` - Test du endpoint

### Monitoring (2 fichiers)

6. **monitoring/prometheus/alertmanager.yml**
   - Configuration Alertmanager
   - Webhook vers alert-ingestion
   - Règles de groupage
   - Règles d'inhibition

7. **monitoring/prometheus/alerts.yml**
   - Règles d'alertes exemples :
     - HighMemoryUsage (high)
     - HighCPUUsage (warning)
     - ServiceDown (critical)
     - DiskSpaceLow (warning)
     - HighErrorRate (high)

### Documentation (5 fichiers)

8. **QUICKSTART.md** - Guide rapide en anglais
9. **IMPLEMENTATION.md** - Documentation technique en anglais
10. **MODIFICATIONS.md** - Liste de changements en anglais
11. **ARCHITECTURE.md** - Vue d'ensemble en anglais
12. **README_CHANGES.md** - Résumé en anglais

---

## 🐳 Services Docker

| Service | Port | Statut | Rôle |
|---------|------|--------|------|
| PostgreSQL | 5432 | Existant | Base de données |
| **Redis** | 6379 | **Nouveau** | Files d'alertes |
| Prometheus | 9090 | Modifié | Métriques & alertes |
| **Alertmanager** | 9093 | **Nouveau** | Routage d'alertes |
| Alert Ingestion | 8001 | Modifié | Service principal |
| Incident Mgmt | 8002 | Existant | Gestion incidents |
| OnCall Service | 8003 | Existant | Astreintes |
| Grafana | 3000 | Existant | Tableaux de bord |
| Web UI | 8080 | Existant | Interface web |

---

## 📊 Métriques Disponibles

Accessibles à `http://localhost:8001/metrics` :

```
# Vérification
alerts_verified_total{status="passed"}
alerts_verified_total{status="failed"}

# Normalisation
alerts_normalized_total

# Files
alerts_queued_total{queue="raw"}
alerts_queued_total{queue="success"}
alerts_queued_total{queue="retry"}
alerts_queued_total{queue="error"}

# Réessais
alerts_retried_total

# Erreurs
alerts_failed_total{stage="verification"}
alerts_failed_total{stage="normalization"}
```

---

## 🔧 Configuration

### Variables d'Environnement
```bash
PORT=8001
REDIS_URL=redis://redis:6379
PROMETHEUS_URL=http://prometheus:9090
DATABASE_URL=postgres://postgres:postgres@localhost:5432/incident_platform
```

### Configuration des Réessais
```javascript
normalization: {
  maxRetries: 3,        // 3 tentatives maximum
  retryDelayMs: 5000    // 5 secondes entre chaque tentative
}
```

---

## 🧪 Scénarios de Test

### Test 1 : Alerte Valide ✅
```bash
curl -X POST http://localhost:8001/api/prometheus/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "alerts": [{
      "status": "firing",
      "labels": {
        "alertname": "TestSuccess",
        "severity": "critical",
        "instance": "server-01"
      },
      "annotations": {"summary": "Test OK"},
      "startsAt": "2026-02-09T14:30:00Z"
    }]
  }'
```
**Résultat :** Vérification OK → Normalisation OK → File Success

### Test 2 : Alerte Sans Severity ❌
```bash
curl -X POST http://localhost:8001/api/prometheus/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "alerts": [{
      "status": "firing",
      "labels": {"alertname": "Test"},
      "annotations": {"summary": "Test"},
      "startsAt": "2026-02-09T14:30:00Z"
    }]
  }'
```
**Résultat :** Vérification échouée → File Error

### Test 3 : Severity Invalide ⚠️
```bash
curl -X POST http://localhost:8001/api/prometheus/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "alerts": [{
      "status": "firing",
      "labels": {
        "alertname": "Test",
        "severity": "invalid-level"
      },
      "annotations": {"summary": "Test"},
      "startsAt": "2026-02-09T14:30:00Z"
    }]
  }'
```
**Résultat :** Vérification OK → Normalisation échouée → File Retry → (3x) → File Error

---

## 🔍 Monitoring et Debug

### Consulter les Statistiques
```bash
curl http://localhost:8001/api/prometheus/stats
```

### Voir les Logs
```bash
docker logs -f alert-ingestion
```

### Inspecter Redis
```bash
# Entrer dans Redis CLI
docker exec -it redis redis-cli

# Lister les clés
KEYS *

# Longueur d'une file
LLEN bull:success-alerts:wait

# Voir un job
LRANGE bull:success-alerts:completed 0 0
```

### Voir les Métriques
```bash
curl http://localhost:8001/metrics | grep alerts_
```

---

## ✅ Checklist de Vérification

- [x] Redis ajouté à docker-compose
- [x] Alertmanager ajouté à docker-compose
- [x] Prometheus configuré pour l'alerting
- [x] Service de vérification implémenté
- [x] Service de normalisation implémenté
- [x] Gestion de files avec Bull/Redis
- [x] Logique de réessai configurée
- [x] Endpoint webhook pour Prometheus
- [x] Endpoint de statistiques
- [x] Métriques complètes
- [x] Règles d'alertes exemples
- [x] Documentation créée (en anglais)
- [x] Aucune erreur de compilation

---

## 🎯 Points Clés de l'Implémentation

### Vérification des Alertes
- **8 critères** de validation
- Échec → **File Error** immédiat
- Support de **mapping de severity**

### Normalisation
- Format **standardisé** pour tous les systèmes
- ID **unique** généré (UUID)
- **Préservation** des données brutes

### Files Redis
- **4 files séparées** pour workflow clair
- **Automatic retry** configurable
- **Monitoring** via métriques

### Traitement Asynchrone
- **Non-bloquant** avec files
- **Scalable** pour haut volume
- **Résilient** avec réessais automatiques

---

## 📞 Support et Dépannage

### Problème : Services ne démarrent pas
**Solution :** Vérifier `docker-compose up -d` et `docker ps`

### Problème : Webhook retourne erreur 500
**Solution :** Consulter les logs avec `docker logs alert-ingestion`

### Problème : Alertes non traitées
**Solution :** Vérifier les stats `curl http://localhost:8001/api/prometheus/stats`

### Problème : Taux d'erreur élevé
**Solution :** Inspecter la file d'erreurs dans Redis

---

## 🎉 Résultat Final

Vous avez maintenant :

✅ **Pipeline complet** de Prometheus à données normalisées  
✅ **Traitement fiable** avec réessais automatiques  
✅ **Visibilité totale** avec métriques et logs  
✅ **Prêt pour production** avec Docker  
✅ **Documentation complète** en anglais (5 fichiers)  
✅ **Facilement testable** avec exemples curl  
✅ **Architecture scalable** basée sur files  

---

## 📚 Documentation Complète

Tous les fichiers de documentation sont **en anglais** :

1. **QUICKSTART.md** - Démarrage rapide et tests
2. **ARCHITECTURE.md** - Vue d'ensemble architecture
3. **IMPLEMENTATION.md** - Documentation technique détaillée
4. **MODIFICATIONS.md** - Liste complète des changements
5. **README_CHANGES.md** - Résumé des modifications

---

**Statut :** ✅ **IMPLÉMENTATION TERMINÉE**  
**Version :** 1.0.0  
**Date :** 9 février 2026  
**Prêt pour :** Tests en production

---

Pour plus de détails, consultez les fichiers de documentation en anglais dans le répertoire `services/alert-ingestion/`.

