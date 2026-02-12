# 🎓 Know Your Faculty - Automated Faculty Directory

> A modern React application with automated weekly faculty data scraping and public access to faculty information. No authentication required for viewing!

## ✨ Features

### 🤖 Automation
- **Weekly Scraping**: Runs every Sunday at 1:00 AM automatically
- **Smart Deduplication**: Prevents duplicate faculty entries
- **Photo Management**: Automatic photo upload and storage
- **Health Monitoring**: Built-in health checks and logging

### 🌐 Public Access
- **No Login Required**: View faculty data without authentication
- **Advanced Search**: Filter by name, department, designation
- **Real-time Stats**: Faculty analytics and trends
- **4-Column Layout**: Modern, responsive design

### ⚡ Performance
- **Fast Loading**: Optimized pagination (20 items/page)
- **Sample Fallback**: Works immediately with demo data
- **Lazy Loading**: Images load on-demand
- **Responsive**: Mobile, tablet, and desktop optimized

## 📁 Project Structure

See [PROJECT_STRUCTURE.md](PROJECT_STRUCTURE.md) for detailed documentation.

```
KnowYourFaculty/
├── src/
│   ├── components/         # React UI components
│   ├── config/            # Client/Server configurations
│   ├── lib/               # Core libraries
│   │   ├── appwrite/      # Backend services
│   │   └── scraper/       # Web scraping system
│   └── services/          # Frontend services
├── scripts/               # Automation scripts
└── public/                # Static assets
```

## 🚀 Quick Start

### Prerequisites

- **Node.js** v18 or higher
- **Appwrite** account and project
- **VIT-AP CMS** API access token

### 1. Installation

```bash
# Clone the repository
git clone <your-repo-url>
cd KnowYourFaculty

# Install dependencies
npm install
```

### 2. Environment Setup

Create a `.env` file in the root directory:

```env
# Appwrite Configuration
VITE_APPWRITE_URL=https://cloud.appwrite.io/v1
VITE_APPWRITE_PROJECT_ID=your-project-id
VITE_APPWRITE_DB_ID=your-database-id
VITE_APPWRITE_TABLE_ID=your-table-id
VITE_APPWRITE_BUCKET_ID=your-bucket-id
VITE_APPWRITE_API_TOKEN=your-api-key

# VIT-AP CMS Access
VITE_AUTH_TOKEN=your-cms-token
```

### 3. Database Permissions (Important!)

In your Appwrite console:
1. Navigate to your faculty collection
2. Go to **Settings** → **Permissions**
3. Add permission:
   - **Role**: Any
   - **Permission**: Read ✓
4. Save changes

Without this, the app will show sample data instead of real faculty.

### 4. Setup Automated Scraper

#### Windows
```powershell
npm run scraper:setup    # Sets up Task Scheduler
```

#### Linux/macOS
```bash
chmod +x scripts/setup.sh
./scripts/setup.sh       # Sets up cron job
```

#### Manual Test
```bash
npm run scraper:run      # Test scraper manually
npm run scraper:health   # Check health status
npm run faculty:count    # Count faculty in DB
```

### 5. Start Development

```bash
npm run dev              # Start at localhost:5173

# View faculty statistics
npm run faculty:stats

# Check faculty count
npm run faculty:count
```

## 📋 Available Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run preview` | Preview production build |
| `npm run scraper:run` | Run scraper manually |
| `npm run scraper:health` | Check scraper health |
| `npm run scraper:setup` | Setup automated scheduling |
| `npm run faculty:stats` | View faculty statistics |
| `npm run faculty:count` | Get total faculty count |

## 🤖 Automated Scraper

### How It Works

1. **Scheduled Execution**: Windows Task Scheduler runs the scraper every Sunday at 1:00 AM
2. **Data Fetching**: Scrapes latest faculty profiles from VIT-AP CMS API
3. **Duplicate Prevention**: Checks existing records to avoid duplicates
4. **Photo Management**: Downloads and stores faculty photos in Appwrite Storage
5. **Error Handling**: Logs errors and continues processing remaining records
6. **Completion Logging**: Records success/failure statistics

### Monitoring

```bash
# Check scraper health
npm run scraper:health

# View logs (Windows)
type logs\scraper.log

# Manual test run
npm run scraper:run
```

### Troubleshooting

**Scraper fails to start:**
- Check environment variables in `.env`
- Verify Appwrite API key permissions
- Ensure VIT-AP CMS token is valid

**No new faculty added:**
- Faculty may already exist (check employee IDs)
- API may be returning empty results
- Check network connectivity

**Photos not uploading:**
- Photo URLs may be invalid or inaccessible
- Appwrite Storage bucket may be full
- Check bucket permissions

## 🌐 Public API Usage

The faculty data is accessible without authentication:

### React Components

```jsx
import publicFacultyService from './services/publicFacultyService.js';

// Get faculty list with pagination
const facultyData = await publicFacultyService.getFacultyList({
  page: 1,
  limit: 20,
  search: 'Dr. Smith',
  department: 'Computer Science'
});

// Get specific faculty member
const faculty = await publicFacultyService.getFacultyById(12345);

// Get departments list
const departments = await publicFacultyService.getDepartments();

// Get statistics
const stats = await publicFacultyService.getFacultyStats();
```

### Available Components

- `<FacultyList />` - Paginated faculty directory with search and filters
- `<FacultyDashboard />` - Statistics and analytics dashboard
- `<FacultyCard />` - Individual faculty member card

## 📊 Data Structure

### Faculty Record

```javascript
{
  $id: "unique-appwrite-id",
  employeeId: 12345,
  name: "Dr. Jane Smith",
  designation: "Associate Professor",
  department: "School of Computer Science",
  subDepartment: "AI & ML",
  educationUG: "B.Tech Computer Science",
  educationPG: "M.Tech Machine Learning", 
  educationPhD: "PhD Artificial Intelligence",
  educationOther: null,
  researchArea: "Machine Learning, NLP, Computer Vision",
  photoFileId: "appwrite-file-id",
  $createdAt: "2024-01-01T00:00:00.000Z",
  $updatedAt: "2024-01-07T01:00:00.000Z"
}
```

## 🔐 Security & Privacy

- **No Authentication Required**: Faculty data is public
- **Read-Only Access**: Frontend cannot modify faculty data
- **Rate Limiting**: Appwrite handles API rate limiting
- **CORS Protection**: Configured for your domain only
- **Environment Variables**: Sensitive data stored securely

## 🚀 Deployment

### Frontend (Vercel/Netlify)

1. Build the application:
   ```bash
   npm run build
   ```

2. Deploy the `dist` folder to your hosting provider

3. Configure environment variables in your hosting dashboard

### Scraper (Server/VPS)

1. Clone repository on your server
2. Setup environment variables
3. Run scraper setup:
   ```bash
   chmod +x scheduler/setup.sh
   ./scheduler/setup.sh
   ```

## 📈 Performance

- **Fast Loading**: <2s initial page load
- **Efficient Pagination**: 20 records per page
- **Optimized Images**: WebP format with compression
- **Debounced Search**: 300ms delay to reduce API calls
- **Cached Statistics**: Updated weekly with scraper

## 🔧 Configuration

### Appwrite Database Schema

```json
{
  "employeeId": { "type": "integer", "required": true, "array": false },
  "name": { "type": "string", "required": true, "size": 255 },
  "designation": { "type": "string", "required": false, "size": 255 },
  "department": { "type": "string", "required": false, "size": 500 },
  "subDepartment": { "type": "string", "required": false, "size": 255 },
  "educationUG": { "type": "string", "required": false, "size": 500 },
  "educationPG": { "type": "string", "required": false, "size": 500 },
  "educationPhD": { "type": "string", "required": false, "size": 500 },
  "educationOther": { "type": "string", "required": false, "size": 500 },
  "researchArea": { "type": "string", "required": false, "size": 1000 },
  "photoFileId": { "type": "string", "required": false, "size": 50 }
}
```

### Required Indexes

- `employeeId` (unique)
- `department` (for filtering)
- `name` (for search)

## 🆘 Support

### Common Issues

**Environment Variables Not Found:**
```bash
# Check if .env file exists and has correct VITE_ prefixes
ls -la .env
grep VITE_ .env
```

**Scraper Permission Denied:**
```bash
# Make scripts executable (Linux/Mac)
chmod +x scheduler/setup.sh
chmod +x scheduler/autoScraper.js
```

**Windows Task Scheduler Issues:**
- Run PowerShell as Administrator
- Check ExecutionPolicy: `Set-ExecutionPolicy -ExecutionPolicy RemoteSigned`
- Verify Node.js is in system PATH

### Getting Help

1. Check the logs: `logs/scraper.log`
2. Run health check: `npm run scraper:health`
3. Test manual run: `npm run scraper:run`
4. Verify environment variables are correct
5. Check Appwrite project permissions

## 📄 License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

---

**Built with ❤️ for VIT-AP University**

*Last updated: February 2026*
#   K n o w Y o u r F a c u l t y  
 