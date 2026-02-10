# Web UI Service

This is the frontend React application for the Hackaton Solution project. It provides a user interface for interacting with the alerting, incident management, and notification services.

## Features
- Dashboard for monitoring alerts and incidents
- Incident detail and management views
- Integration with backend services via REST APIs
- Responsive design for desktop and mobile

## Project Structure
```
services/web-ui/
├── Dockerfile
├── package.json
├── public/
│   └── index.html
├── src/
│   ├── App.jsx
│   ├── index.js
│   ├── components/
│   ├── Header/
│   ├── pages/
│   └── ...
```

## Getting Started

### Prerequisites
- Node.js (v16 or higher recommended)
- npm (v8 or higher)

### Installation
1. Navigate to the web-ui directory:
   ```bash
   cd services/web-ui
   ```
2. Install dependencies:
   ```bash
   npm install
   ```

### Running the Development Server
```bash
npm start
```
The app will be available at [http://localhost:3000](http://localhost:3000) by default.

### Building for Production
```bash
npm run build
```
The production-ready files will be in the `build/` directory.

### Running Tests
```bash
npm test
```

## Docker Usage
To build and run the app using Docker:
```bash
docker build -t hackaton-web-ui .
docker run -p 3000:3000 hackaton-web-ui
```

## Environment Variables
You can configure API endpoints and other settings using a `.env` file in the root of the `web-ui` directory.

## Contributing
1. Fork the repository
2. Create a new branch (`git checkout -b feature/your-feature`)
3. Commit your changes (`git commit -am 'Add new feature'`)
4. Push to the branch (`git push origin feature/your-feature`)
5. Create a Pull Request

## License
This project is licensed under the MIT License.
