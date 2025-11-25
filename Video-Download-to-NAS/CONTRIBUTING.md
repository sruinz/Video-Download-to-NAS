# About This Project

## 📌 Project Status: Personal Use

**This is a personal project that is feature-complete and maintained for personal use.**

### What This Means

- ✅ **Open Source**: The code is freely available for anyone to use, study, and fork
- ✅ **Stable**: The project is considered complete and stable for its intended use
- ❌ **Not Accepting PRs**: Pull requests are not actively reviewed or merged
- ❌ **Limited Support**: No commitment to feature requests or extensive support

### Recommended Approach

If you want to use or modify this project:

1. **Fork the repository** - Create your own copy
2. **Make your changes** - Customize it for your needs
3. **Maintain your fork** - Keep it updated as you see fit
4. **Share your fork** - Others might benefit from your improvements

This approach gives you full control and doesn't depend on this repository being actively maintained.

## 🐛 Bug Reports

While pull requests are not accepted, **bug reports are welcome**:

- Use GitHub Issues to report bugs
- Include detailed reproduction steps
- Provide system information
- No guarantee of fixes, but reports help document known issues

## 💡 Feature Requests

Feature requests are **not actively considered**, but you can:

- Fork the project and implement features yourself
- Share your fork with others who want the same features
- Document your changes for others to learn from

## Legal Compliance

### Important Notice

By contributing to this project, you acknowledge that:

1. **Tool Purpose**: This is a general-purpose media downloading tool
2. **User Responsibility**: Users are responsible for their own actions
3. **No Liability**: Contributors are not liable for how users use the software
4. **Legal Use**: The tool is intended for legitimate, legal purposes only

### Contribution Guidelines

When contributing, please ensure:

- ✅ Your code does not encourage illegal activities
- ✅ Documentation emphasizes legal and responsible use
- ✅ Features support legitimate use cases
- ✅ No hardcoded content sources or copyrighted material

## 🔧 How to Fork and Customize

### Step 1: Fork the Repository

Click the "Fork" button on GitHub to create your own copy.

### Step 2: Clone Your Fork

```bash
git clone https://github.com/YOUR-USERNAME/Video-Download-to-NAS.git
cd Video-Download-to-NAS
```

### Step 3: Make Your Changes

Follow the coding standards below and make your modifications.

### Step 4: Maintain Your Fork

```bash
# Commit your changes
git add .
git commit -m "feat: Add my custom feature"

# Push to your fork
git push origin main
```

### Step 5: (Optional) Share Your Fork

If your changes might benefit others:
- Update your fork's README with your changes
- Add a note that it's a fork with custom features
- Share the link in discussions or issues

## Coding Standards

### Python (Backend)

- Follow PEP 8
- Use type hints
- Write docstrings for functions
- Keep functions focused and small
- Use meaningful variable names

```python
def download_video(url: str, resolution: str) -> dict:
    """
    Download video from URL with specified resolution.
    
    Args:
        url: Video URL
        resolution: Desired resolution (e.g., '1080p')
    
    Returns:
        dict: Download result with status and file info
    """
    pass
```

### JavaScript/React (Frontend)

- Use ES6+ features
- Functional components with hooks
- Meaningful component names
- Keep components focused
- Use proper prop types

```jsx
export default function VideoCard({ video, onDelete }) {
  const [isDeleting, setIsDeleting] = useState(false);
  
  // Component logic
  
  return (
    <div className="video-card">
      {/* Component JSX */}
    </div>
  );
}
```

### Documentation

- Update README.md for major changes
- Add inline comments for complex logic
- Update API documentation
- Include examples where helpful

## Testing

### Backend Tests

```bash
cd backend
pytest
```

### Frontend Tests

```bash
cd frontend
npm test
```

### Manual Testing

1. Build Docker images
2. Test in clean environment
3. Verify all features work
4. Check for errors in logs

## Development Setup

### Prerequisites

- Docker & Docker Compose
- Python 3.11+
- Node.js 18+
- Git

### Local Development

1. **Clone repository**
   ```bash
   git clone https://github.com/sruinz/Video-Download-to-NAS.git
   cd Video-Download-to-NAS
   ```

2. **Backend setup**
   ```bash
   cd backend
   pip install -r requirements.txt
   uvicorn app.main:app --reload
   ```

3. **Frontend setup**
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

## Project Structure

```
repo/
├── .github/              # GitHub templates
├── README.md             # Main documentation
├── README.ko.md          # Korean documentation
└── Video-Download-to-NAS/
    ├── backend/          # FastAPI backend
    │   ├── app/
    │   │   ├── routers/  # API routes
    │   │   ├── main.py   # Main app
    │   │   └── ...
    │   └── requirements.txt
    ├── frontend/         # React frontend
    │   ├── src/
    │   │   ├── components/
    │   │   ├── pages/
    │   │   └── ...
    │   └── package.json
    ├── docker-compose.yml
    ├── LICENSE
    └── ...
```

## Areas for Contribution

### High Priority

- 🐛 Bug fixes
- 📝 Documentation improvements
- 🔒 Security enhancements
- ♿ Accessibility improvements
- 🌍 Internationalization (i18n)

### Medium Priority

- ✨ New features (discuss first)
- 🎨 UI/UX improvements
- ⚡ Performance optimizations
- 🧪 Test coverage

### Low Priority

- 🎨 Code style improvements
- 📦 Dependency updates
- 🔧 Refactoring

## Communication

### Channels

- **GitHub Issues**: Bug reports, feature requests
- **GitHub Discussions**: General questions, ideas
- **Pull Requests**: Code contributions

### Response Time

- We aim to respond within 1-2 weeks
- Be patient, this is maintained by volunteers
- Urgent security issues: Create private security advisory

## 🌟 Sharing Your Fork

If you create a useful fork:
- Document your changes clearly
- Update the README to explain your modifications
- Consider creating a separate repository
- Link back to the original project

## Legal

### License

By contributing, you agree that your contributions will be licensed under the MIT License.

### Copyright

- You retain copyright of your contributions
- You grant the project a perpetual license to use your contributions
- Ensure you have rights to contribute the code

### Third-Party Code

- Do not include copyrighted code without permission
- Clearly mark third-party code with licenses
- Ensure compatibility with MIT License

## Questions?

If you have questions:
1. Check existing documentation
2. Search closed issues
3. Ask in GitHub Discussions
4. Create a new issue if needed

---

Thank you for contributing to VDTN! Your efforts help make this tool better for everyone while maintaining its focus on legitimate, legal use cases.
