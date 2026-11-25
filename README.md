# 🌱 AWTC Volunteer Web App

A web application to manage volunteer projects, allowing volunteers to register, sign up for projects, access resources, and communicate with coordinators.
The application is designed to be cross-platform, responsive, and accessible, with full CRUD functionalities.

**Status**: Backend is fully functional with CRUD operations for projects, categories, reviews, users, and contacts. Frontend is built in React + TypeScript with responsive UI, internationalization (i18n), and connects with backend APIs.

**Live Demo**: [https://awilltochange.me](https://awilltochange.me)

---

## 📝 Scope & Features

### Users & Roles

#### Volunteers
- Register and log in
- Edit profile with profile image
- Sign up for projects
- Access resources
- Leave reviews and comments
- View project details and volunteer opportunities

#### Coordinators
- Create, edit, and delete projects
- Manage project enrollments and volunteer status
- Add resources and project images
- Moderate reviews and comments
- View volunteer statistics

#### Admin
- Complete system management
- User role management
- Project and category oversight
- Contact and review moderation
- Dashboard access

---

## ✅ Fully Implemented Features
- **User Management**: Registration, login, profile editing with image upload, authentication via OpenLDAP
- **Project Management**: Full CRUD for projects with categories, descriptions, dates, locations, and images
- **Project Enrollments**: Users can enroll/volunteer for projects with status tracking (pending, accepted, rejected, completed)
- **Reviews & Ratings**: Users can leave reviews with images for completed projects
- **Categories**: Full CRUD for project categorization
- **Contact Management**: CRUD for contact submissions
- **User Bans**: System to ban users from specific projects
- **Dashboard**: Admin dashboard with statistics, pagination, and user/project management
- **Dashboard Styling**: Modern UI with white sidebar, updated color scheme, and enhanced visual design
- **Internationalization (i18n)**: Full support for English, Spanish, and French languages
- **Info Banner**: Dismissible notification banner informing users about content language
- **API Documentation**: Swagger/OpenAPI documentation at `/api-docs`
- **Session Management**: Express session with secure cookies
- **Authentication**: JWT and session-based authentication with OpenLDAP integration
- **File Uploads**: Multer integration for profile images and project/review images
- **Real-time Updates**: Socket.io for live review updates
- **HTTPS**: SSL/TLS encryption with Let's Encrypt certificates

---

## 📈 Planned Features (Future)
- Advanced search and filtering (by name, category, date, accessibility)
- Volunteer hours tracking and certificates
- Email notifications and reminders
- Advanced dashboards with charts and analytics
- Resource library per project

---

## ⚡ Technologies

### Frontend
- **React** 19.1.1 with TypeScript 5.9.3
- **React Router** 7.9.5 for navigation
- **Vite** 7.1.7 for fast development and building
- **Tailwind CSS** 4.1.16 for styling
- **Framer Motion** 12.23.24 for animations
- **GSAP** 3.13.0 for advanced animations
- **i18next** 23.11.5 & **react-i18next** 14.1.2 for internationalization (EN, ES, FR)
- **i18next-browser-languagedetector** 8.0.0 for automatic language detection
- **Socket.io Client** 4.8.1 for real-time updates
- **Axios** 1.13.2 for HTTP requests
- **FontAwesome** 7.1.0 & **Heroicons** 2.2.0 for icons
- **Hamburger React** 2.5.2 for mobile menu
- **React Loader Spinner** 8.0.0 & **React Loading Indicators** 1.0.1 for loading states
- **Push Notifications** with Service Worker integration
- **Vitest** 4.0.15 & **Testing Library** for unit testing
- **ESLint** 9.36.0 for code quality

### Backend
- **Node.js** with Express 5.1.0
- **Sequelize** 6.37.7 ORM for MySQL
- **MySQL2** 3.15.3 database driver
- **JWT** (jsonwebtoken 9.0.2) for token-based authentication
- **Bcrypt** 6.0.0 for password hashing
- **OpenLDAP** & **ldapjs** 3.0.7 for LDAP authentication
- **Multer** 2.0.2 for file uploads
- **Express Session** 1.18.2 with **connect-session-sequelize** 8.0.2 for session management
- **Cookie Parser** 1.4.7 for cookie handling
- **Socket.io** 4.8.1 for real-time WebSocket communication
- **Web Push** 3.6.7 for push notifications
- **Swagger** (swagger-jsdoc 6.2.8, swagger-ui-express 5.0.1) for API documentation
- **EJS** 3.1.10 for server-side templating (admin dashboard)
- **D3.js** 7.9.0 for data visualizations
- **DNS2** 2.1.0 for custom DNS server
- **Morgan** 1.10.1 for HTTP request logging
- **Winston** 3.19.0 & **winston-daily-rotate-file** 5.0.0 for application logging
- **Cross-env** 7.0.3 for cross-platform environment variables
- **Nodemon** 3.1.10 for development auto-reload
- **Jest** 29.7.0 & **Supertest** 6.3.3 for testing
- **CORS** 2.8.5 for cross-origin requests
- **Dotenv** 16.4.5 for environment configuration

---

## 🚀 Getting Started

### Prerequisites
- Node.js (v14+ recommended)
- MySQL (v5.7+ or v8.0)
- npm or yarn

### Backend Setup

1. Start LDAP Service (Docker):
```bash
cd backend
docker-compose up -d
```

2. Navigate to backend folder and install dependencies:
```bash
npm install
```

3. Configure environment and database:
   - Copy the template and fill in your values (the copy is git-ignored, never commit secrets):
```bash
cp .env.example .env.development.local
```
   - Generate `JWT_SECRET` and `SESSION_SECRET` with `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"` and VAPID keys with `npx --yes web-push generate-vapid-keys`.
   - `config/sequelize.config.js` reads the `DB_*` variables.

4. Run migrations and seeders:
```bash
npm run migrate
npm run seed
# Sync initial users to LDAP (passwords are read from the environment, never hardcoded)
LDAP_ADMIN_PASSWORD=<admin password> LDAP_SEED_PASSWORD=<password for the seed users> node scripts/sync-ldap-users.js
```

5. Start the server:
```bash
npm run dev    # Development mode with nodemon
npm start      # Production mode
```

Server runs at: **https://awilltochange.me/**
- API Documentation: https://awilltochange.me/api-docs
- Admin Dashboard: https://awilltochange.me/admin/ (requires login)

### Frontend Setup

1. Navigate to frontend folder:
```bash
cd ../frontend
npm install
```

2. Start development server:
```bash
npm run dev
```

Frontend runs at: **https://awilltochange.me/**

3. Build for production:
```bash
npm run build
```

**Important**: Make sure the backend server is running on port 8080 so the frontend can fetch data from the API.

### Default Credentials
After running seeders and LDAP sync, an admin user is automatically created:
- **Email**: admin@awtc.es
- **Password**: (Check with administrator)

### Free public demo deployment
To publish a test site (Vercel + Render + Aiven MySQL + Cloudinary) with one-click demo accounts
for the three roles and a nightly data reset, follow [docs/deploy-demo.md](docs/deploy-demo.md).

---

## 📂 Project Structure

```
AWTC/
├── backend/
│   ├── config/                          # Configuration files
│   │   ├── sequelize.config.js         # Database config (reads DB_* env vars)
│   │   ├── db.config.js                # Sequelize connection
│   │   ├── initAdmin.js                # Initial admin setup
│   │   └── sequelize.config.js         # Sequelize CLI config
│   ├── controllers/                     # Request handlers
│   │   ├── project.controller.js
│   │   ├── category.controller.js
│   │   ├── reviews.controller.js
│   │   ├── user.controller.js
│   │   ├── contact.controller.js
│   │   ├── session.controller.js
│   │   ├── message.controller.js
│   │   ├── subscription.controller.js
│   │   └── external.controller.js
│   ├── middlewares/                     # Express middlewares
│   │   ├── auth.middlewares.js         # JWT/Bearer auth
│   │   ├── requireAuth.js              # Session check
│   │   └── role.middlewares.js         # Role-based access
│   ├── models/                          # Sequelize models
│   │   ├── project.js
│   │   ├── category.js
│   │   ├── reviews.js
│   │   ├── user.js
│   │   ├── contact.js
│   │   ├── message.js
│   │   ├── subscription.js
│   │   ├── userproject.js
│   │   └── userprojectban.js
│   ├── migrations/                      # Database migrations
│   ├── seeders/                         # Initial data seeders
│   ├── routes/                          # API routes
│   ├── multer/                          # File upload config
│   ├── public/images/                   # Uploaded files
│   ├── public/css/                      # Dashboard stylesheets
│   │   ├── dashboard.css               # Main dashboard styles
│   │   ├── login.css                   # Login page styles
│   │   ├── projects-dashboard.css
│   │   ├── users-dashboard.css
│   │   ├── reviews-dashboard.css
│   │   ├── categories-dashboard.css
│   │   └── incidents-dashboard.css
│   ├── views/                           # EJS templates (dashboard)
│   ├── utils/                           # Utility functions
│   ├── swagger.js                       # OpenAPI documentation
│   ├── index.js                         # Main server file
│   ├── package.json
│   └── .env.development                 # Environment variables
│
└── frontend/
    ├── src/
    │   ├── components/                  # React components
    │   │   ├── NavBar.tsx
    │   │   ├── Footer.tsx
    │   │   ├── InfoBanner.tsx           # Dismissible info banner (i18n)
    │   │   ├── Projects.tsx
    │   │   ├── Categories.tsx
    │   │   ├── VolunteerList.tsx
    │   │   ├── AuthModal.tsx
    │   │   ├── ConfirmModal.tsx
    │   │   ├── LanguageSelector.tsx     # Language switcher (i18n)
    │   │   ├── FloatingMessageButton.tsx
    │   │   ├── Chat.tsx                 # Real-time chat
    │   │   └── ...
    │   ├── pages/                       # Page components
    │   │   ├── Home.tsx
    │   │   ├── Dashboard.tsx
    │   │   ├── Messages.tsx
    │   │   ├── AboutUs.tsx
    │   │   ├── Volunteering.tsx
    │   │   ├── MoreInfo.tsx
    │   │   ├── Privacy.tsx
    │   │   └── Terms.tsx
    │   ├── i18n/                        # Internationalization
    │   │   ├── index.ts                 # i18n configuration
    │   │   └── locales/                 # Translation files
    │   │       ├── en.json              # English
    │   │       ├── es.json              # Spanish
    │   │       └── fr.json              # French
    │   ├── assets/                      # Static assets
    │   ├── api.ts                       # API client (Axios)
    │   ├── App.tsx                      # Main app component
    │   ├── main.tsx                     # Entry point
    │   └── index.css                    # Global styles
    ├── public/
    │   └── aboutUs/                     # Public assets
    ├── dist/                            # Built production files
    ├── vite.config.ts
    ├── tsconfig.json
    ├── package.json
    └── README.md
```

---

## 📌 API Endpoints

### Authentication
- `POST /login` – User login (session-based)
- `POST /logout` – User logout
- `POST /api/users/signup` – User registration

### Projects
- `GET /api/projects` – Get all projects with filtering
- `GET /api/projects/:id` – Get project by ID
- `POST /api/projects` – Create project (Coordinator/Admin)
- `PUT /api/projects/:id` – Update project (Coordinator/Admin)
- `DELETE /api/projects/:id` – Delete project (Coordinator/Admin)

### Categories
- `GET /api/categories` – Get all categories
- `GET /api/categories/:id` – Get category by ID
- `POST /api/categories` – Create category (Coordinator/Admin)
- `PUT /api/categories/:id` – Update category (Coordinator/Admin)
- `DELETE /api/categories/:id` – Delete category (Coordinator/Admin)

### Reviews
- `GET /api/reviews` – Get all reviews
- `GET /api/reviews/:id` – Get review by ID
- `POST /api/reviews` – Create review (Volunteer)
- `PUT /api/reviews/:id` – Update review (Coordinator/Admin)
- `DELETE /api/reviews/:id` – Delete review (Coordinator/Admin)

### Users
- `GET /api/users` – Get all users (Admin)
- `GET /api/users/:id` – Get user by ID
- `POST /api/users` – Create user
- `PUT /api/users/:id` – Update user profile
- `PUT /api/users/:id/role` – Update user role (Admin)
- `DELETE /api/users/:id` – Delete user (Admin)

### Contacts
- `GET /api/contacts` – Get all contacts (Admin)
- `POST /api/contacts` – Create contact form submission
- `DELETE /api/contacts/:id` – Delete contact (Admin)

### Volunteering
- `GET /api/projects/:id/volunteers` – Get project volunteers
- `POST /api/projects/:id/volunteer` – Enroll in project
- `PUT /api/projects/:id/volunteer/:userId` – Update volunteer status
- `DELETE /api/projects/:id/volunteer/:userId` – Remove volunteer

### Messages (Real-time Chat)
- `GET /api/messages` – Get user's messages
- `GET /api/messages/:userId` – Get conversation with specific user
- `POST /api/messages` – Send message
- `PUT /api/messages/:id/read` – Mark message as read
- `GET /api/messages/unread-count` – Get unread message count
- `GET /api/messages/available-users` – Get list of available users for messaging

### Push Notifications
- `POST /api/subscriptions/subscribe` – Subscribe to push notifications
- `POST /api/subscriptions/unsubscribe` – Unsubscribe from push notifications
- `POST /api/subscriptions/test` – Send test notification (Admin only)

### External API
- `GET /api/external/volunteering` – Get volunteer opportunities (public endpoint)

### Dashboard (EJS Views)
- `GET /` – Dashboard overview (requires login)
- `GET /projects` – Projects management
- `GET /users` – Users management
- `GET /reviews` – Reviews management
- `GET /categories` – Categories management
- `GET /incidents` – Incidents/contacts dashboard
- `GET /contacts` – Contacts management
- `GET /login` – Login page
- `GET /debug-models` – Model debugging endpoint (development only)
---

## ⚠️ Important Notes

### Database
- Backend uses **Sequelize ORM** with **MySQL**
- Migrations manage schema changes automatically
- Seeders populate initial data (categories, projects, admin user)
- Always run migrations before starting the app for the first time

### Authentication
- **Session-based** authentication for EJS views (dashboard)
- **JWT + Bearer tokens** for API endpoints
- Role-based access control: `Admin`, `Coordinator`, `Volunteer`
- **Authentication is handled by OpenLDAP** (passwords are not stored in MySQL)

### File Uploads
- Profile images stored in `backend/public/images/`
- Project and review images also stored in the same directory
- Multer configured for secure file handling

### Frontend
- Built with **React 19** and **TypeScript** for type safety
- Uses **Vite** for fast development and production builds
- **Tailwind CSS** for responsive design
- **React Router** for page navigation
- All components in `/frontend/src/components/` and `/frontend/src/pages/`

### CORS Configuration
- Allowed origins configured in backend/index.js
- Production: https://awilltochange.me
- Development: http://localhost:5173, http://localhost:8080
- Add new URLs if deploying to different servers

### Backend Scripts
```bash
npm run dev          # Start with nodemon (development)
npm start            # Start production server
npm run migrate      # Run pending migrations
npm run seed         # Seed database with initial data
npm run migrate:prod # Migrate in production environment
npm run seed:prod    # Seed in production environment
```

### Frontend Scripts
```bash
npm run dev      # Start Vite dev server
npm run build    # Build for production
```
---

## 📈 Documentation

For detailed system diagrams (E/R Diagram, Class Diagram, Use Case Diagram), see:
- **[System Diagrams](docs/diagrams.md)** - Complete architectural and design diagrams

---

## 🔗 Useful Links

- **GitHub Repository**: [Jeremy-Pacheco/AWTC](https://github.com/Jeremy-Pacheco/AWTC)
- **GitHub Project Board**: [Project Planning](https://github.com/users/Jeremy-Pacheco/projects/2)
- **API Documentation**: [Postman Collection](https://documenter.getpostman.com/view/49651382/2sB3WpQ1PH)
- **Design Mockups**: [Figma Design](https://www.figma.com/design/vjAlUkbNwIuZIhn4Y4IYlx/AWillToChange?node-id=3-195&t=TTOPEcQyHpJGTaGN-1)

---

## 🚢 Deployment

### Production (Digital Ocean)
- **Live URL**: [https://awilltochange.me](https://awilltochange.me)
- **API**: [https://awilltochange.me/api](https://awilltochange.me/api)
- **API Docs**: [https://awilltochange.me/api-docs](https://awilltochange.me/api-docs)
- **Admin Dashboard**: [https://awilltochange.me/admin/](https://awilltochange.me/admin/)
- **Hosted on**: DigitalOcean VPS with Nginx reverse proxy
- **SSL**: Let's Encrypt certificates (auto-renewal via Certbot)