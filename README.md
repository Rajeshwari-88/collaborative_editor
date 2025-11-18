# Collaborative Text Editor with AI Integration

A modern, real-time collaborative text editor with AI-powered features, built with React, Node.js, Socket.io, and OpenAI integration.

## Features

### Core Collaboration
- **Real-time editing** with conflict resolution
- **Multi-user presence** indicators
- **Role-based access control** (owner, editor, viewer, commenter)
- **Document sharing** with permission management
- **Version history** with restore functionality

### AI-Powered Features
- **Grammar checking** and spelling correction
- **Text completion** and writing assistance
- **Multi-language translation**
- **Content summarization**
- Powered by OpenAI GPT models

### Communication
- **Built-in video chat** with WebRTC
- **Comments and suggestions** system
- **Real-time cursor tracking**
- **User presence indicators**

### Document Management
- **Rich text editing** with formatting tools
- **Auto-save** functionality
- **Export capabilities**
- **Document templates**
- **Search and organization**

## Tech Stack

### Frontend
- **React 18** with TypeScript
- **Tailwind CSS** for styling
- **Socket.io Client** for real-time communication
- **Lucide React** for icons
- **WebRTC** for video chat

### Backend
- **Node.js** with Express
- **Socket.io** for real-time features
- **SQLite** database with proper schema
- **JWT** authentication
- **OpenAI API** integration
- **bcryptjs** for password hashing

## Setup Instructions

### Prerequisites
- Node.js 18+ installed
- OpenAI API key
- Modern web browser with WebRTC support

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd collaborative-editor
   ```

2. **Install frontend dependencies**
   ```bash
   npm install
   ```

3. **Install backend dependencies**
   ```bash
   cd server
   npm install
   ```

4. **Configure environment variables**
   ```bash
   cd server
   cp .env.example .env
   ```
   
   Edit `.env` and add your configuration:
   ```env
   # REQUIRED: Get from https://platform.openai.com/api-keys
   OPENAI_API_KEY=your-openai-api-key-here
   
   # REQUIRED: Generate strong secrets for production
   JWT_SECRET=your-super-secret-jwt-key
   SESSION_SECRET=your-session-secret-key
   
   # Optional: Customize other settings
   PORT=3001
   FRONTEND_URL=http://localhost:5173
   ```

5. **Start the backend server**
   ```bash
   cd server
   npm run dev
   ```

6. **Start the frontend development server**
   ```bash
   # In a new terminal, from the root directory
   npm run dev
   ```

7. **Access the application**
   - Open http://localhost:5173 in your browser
   - Create an account or sign in
   - Start collaborating!

## Usage Guide

### Getting Started
1. **Register** a new account or **sign in**
2. **Create** a new document from the dashboard
3. **Share** documents with collaborators using email addresses
4. **Start editing** with real-time collaboration

### AI Features
- **Grammar Check**: Select text and use the AI assistant panel
- **Text Completion**: Highlight partial text for AI suggestions
- **Translation**: Translate content to different languages
- **Summarization**: Generate summaries of long documents

### Collaboration
- **Real-time editing**: See changes from other users instantly
- **Comments**: Add comments and suggestions to specific parts
- **Video chat**: Start video calls directly in the editor
- **Version history**: View and restore previous document versions

### Document Management
- **Auto-save**: Documents save automatically as you type
- **Sharing**: Control who can view, comment, or edit
- **Organization**: Search and filter documents in the dashboard

## API Endpoints

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `GET /api/auth/me` - Get current user

### Documents
- `GET /api/documents` - List user documents
- `POST /api/documents` - Create new document
- `GET /api/documents/:id` - Get document details
- `PUT /api/documents/:id` - Update document content
- `POST /api/documents/:id/share` - Share document
- `GET /api/documents/:id/versions` - Get version history

### AI Features
- `POST /api/ai/grammar-check` - Grammar and spelling check
- `POST /api/ai/complete` - Text completion
- `POST /api/ai/translate` - Text translation
- `POST /api/ai/summarize` - Content summarization

## WebSocket Events

### Document Collaboration
- `join-document` - Join document editing session
- `text-change` - Broadcast text changes
- `cursor-position` - Share cursor position
- `user-joined` / `user-left` - User presence updates

### Communication
- `add-comment` - Add document comment
- `webrtc-offer/answer/ice-candidate` - Video chat signaling

## Database Schema

The application uses SQLite with the following main tables:
- `users` - User accounts and profiles
- `documents` - Document metadata and content
- `document_permissions` - Role-based access control
- `document_versions` - Version history
- `comments` - Document comments and suggestions
- `active_sessions` - Real-time collaboration sessions

## Security Features

- **JWT Authentication** with secure token handling
- **Password hashing** with bcryptjs
- **Role-based access control** for documents
- **Input validation** and sanitization
- **CORS protection** for API endpoints
- **Rate limiting** for API requests

## Performance Optimizations

- **Efficient real-time updates** with Socket.io
- **Optimistic UI updates** for better responsiveness
- **Debounced auto-save** to reduce server load
- **Connection pooling** for database operations
- **Compressed responses** for faster loading

## Browser Support

- Chrome 80+
- Firefox 75+
- Safari 13+
- Edge 80+

WebRTC features require modern browser support for optimal video chat experience.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For issues and questions:
1. Check the documentation above
2. Search existing GitHub issues
3. Create a new issue with detailed information

## Roadmap

- [ ] Mobile app support
- [ ] Advanced document templates
- [ ] Integration with cloud storage
- [ ] Enhanced AI writing features
- [ ] Team workspace management
- [ ] Advanced analytics and insights