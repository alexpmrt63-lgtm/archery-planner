# Pôle France Relève — Planificateur d'entraînements 🏹

Application web pour planifier les entraînements de tir à l'arc.

## Architecture

```
archery-planner/
├── backend/        Node.js + Express (API REST)
├── frontend/       React + Vite + Tailwind (UI)
└── supabase_schema.sql
```

## Installation

### 1. Supabase
1. Créez un projet sur [supabase.com](https://supabase.com)
2. Allez dans **SQL Editor** et exécutez `supabase_schema.sql`
3. Dans **Settings > API**, copiez l'URL et la **service_role key**
4. Dans **Storage**, le bucket `schedule-images` a été créé par le SQL

### 2. Backend
```bash
cd backend
npm install
cp .env.example .env
# Remplissez .env avec vos clés
npm run dev
```

Variables `.env` :
```
PORT=3001
JWT_SECRET=une_chaine_aleatoire_longue
ANTHROPIC_API_KEY=sk-ant-...
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_KEY=eyJ...
FRONTEND_URL=http://localhost:5173
```

### 3. Frontend
```bash
cd frontend
npm install
npm run dev
```

Ouvrez http://localhost:5173

## Créer le premier compte coach

Utilisez la route d'enregistrement (une seule fois) ou directement dans Supabase :

```bash
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"coach@example.com","password":"motdepasse","name":"Coach Dupont","role":"coach"}'
```

Pour les archers, utilisez `"role":"archer"`.

## Fonctionnalités

| Rôle | Fonctionnalité |
|------|---------------|
| Archer | Upload capture d'écran emploi du temps |
| Archer | Visualisation planning complet (cours + entraînements) |
| Coach | Liste des archers (sidebar gauche) |
| Coach | Voir l'emploi du temps + planning de chaque archer |
| Coach | Clic sur le planning pour ajouter un entraînement |
| Coach | Drag & drop pour déplacer un entraînement |
| Coach | Créer des types d'entraînement avec couleurs personnalisées |

## Déploiement

- **Frontend** : `npm run build` → déployer `dist/` sur Vercel
- **Backend** : déployer sur Railway ou Render
- Mettre à jour `FRONTEND_URL` dans les variables d'environnement backend
