import { useState, useEffect } from 'react'
import publicFacultyService from '../services/publicFacultyService.js'

/**
 * 🚧 SETUP HELPER COMPONENT
 * Shows system status and helps with Appwrite configuration
 */
function SetupHelper() {
  const [connectionStatus, setConnectionStatus] = useState('checking')
  const [facultyData, setFacultyData] = useState(null)
  const [errorDetails, setErrorDetails] = useState(null)

  useEffect(() => {
    checkConnection()
  }, [])

  const checkConnection = async () => {
    try {
      setConnectionStatus('checking')
      const data = await publicFacultyService.getFacultyList({ limit: 5 })
      setFacultyData(data)
      setConnectionStatus('connected')
    } catch (error) {
      setErrorDetails(error)
      if (error.message.includes('not authorized') || error.code === 401) {
        setConnectionStatus('permissions')
      } else {
        setConnectionStatus('error')
      }
    }
  }

  const renderConnectionStatus = () => {
    switch (connectionStatus) {
      case 'checking':
        return (
          <div className="bg-blue-50 border border-blue-200 p-6 rounded-lg">
            <div className="flex items-center">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mr-3"></div>
              <h3 className="text-lg font-medium text-blue-800">🔍 Checking Database Connection...</h3>
            </div>
          </div>
        )

      case 'connected':
        return (
          <div className="bg-green-50 border border-green-200 p-6 rounded-lg">
            <h3 className="text-lg font-medium text-green-800 mb-2">✅ Database Connected Successfully!</h3>
            <p className="text-green-700">
              Found {facultyData?.total || 0} faculty members in the database.
              Your faculty directory is ready to use!
            </p>
          </div>
        )

      case 'permissions':
        return (
          <div className="bg-yellow-50 border border-yellow-200 p-6 rounded-lg">
            <h3 className="text-lg font-medium text-yellow-800 mb-4">🔐 Database Permissions Need Setup</h3>
            
            <div className="space-y-4 text-sm text-yellow-700">
              <p><strong>The database is connected, but public read access needs to be configured.</strong></p>
              
              <div className="bg-white p-4 rounded border">
                <h4 className="font-medium mb-2">📋 Steps to Fix:</h4>
                <ol className="list-decimal list-inside space-y-1">
                  <li>Go to your Appwrite Console</li>
                  <li>Navigate to Databases → Your Database → faculty_profiles Collection</li>
                  <li>Go to Settings → Permissions</li>
                  <li>Add Permission: <code className="bg-gray-100 px-1 rounded">Role: Any</code> with <code className="bg-gray-100 px-1 rounded">Read</code> access</li>
                  <li>Save and refresh this page</li>
                </ol>
              </div>
              
              <p className="text-xs">💡 This allows public read-only access to faculty data without authentication.</p>
            </div>
          </div>
        )

      case 'error':
        return (
          <div className="bg-red-50 border border-red-200 p-6 rounded-lg">
            <h3 className="text-lg font-medium text-red-800 mb-4">❌ Database Connection Error</h3>
            
            <div className="space-y-4 text-sm text-red-700">
              <p><strong>Error:</strong> {errorDetails?.message}</p>
              
              <div className="bg-white p-4 rounded border">
                <h4 className="font-medium mb-2">🔧 Troubleshooting:</h4>
                <ul className="list-disc list-inside space-y-1">
                  <li>Check your .env file has correct VITE_* variables</li>
                  <li>Verify Appwrite project ID and database ID</li>
                  <li>Ensure the collection name is "faculty_profiles"</li>
                  <li>Check Appwrite console for any error messages</li>
                </ul>
              </div>
            </div>
          </div>
        )

      default:
        return null
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">
            🎓 Know Your Faculty - System Setup
          </h1>
          <p className="text-gray-600">
            Checking database connection and configuring public access...
          </p>
        </div>

        {/* Connection Status */}
        <div className="max-w-4xl mx-auto mb-8">
          {renderConnectionStatus()}
        </div>

        {/* Action Buttons */}
        <div className="text-center space-x-4">
          <button
            onClick={checkConnection}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            🔄 Recheck Connection
          </button>
          
          {connectionStatus === 'connected' && (
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              🚀 Launch Faculty Directory
            </button>
          )}
        </div>

        {/* Sample Data Preview */}
        {connectionStatus === 'permissions' && (
          <div className="max-w-4xl mx-auto mt-8">
            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-lg font-medium text-gray-800 mb-4">
                📋 Sample Faculty Data Preview
              </h3>
              <p className="text-gray-600 mb-4">
                Here's what your faculty directory will look like once permissions are configured:
              </p>
              
              <SampleFacultyPreview />
            </div>
          </div>
        )}

        {/* System Information */}
        <div className="max-w-4xl mx-auto mt-8 bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-medium text-gray-800 mb-4">📊 System Information</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <strong>🤖 Scraper Status:</strong>
              <p className="text-gray-600">Automatic updates every Sunday at 1:00 AM</p>
            </div>
            <div>
              <strong>🌐 Public Access:</strong>
              <p className="text-gray-600">No login required once permissions are set</p>
            </div>
            <div>
              <strong>📱 Features:</strong>
              <p className="text-gray-600">Search, filter, pagination, analytics</p>
            </div>
            <div>
              <strong>🔒 Security:</strong>
              <p className="text-gray-600">Read-only public access to faculty data</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * 👤 SAMPLE FACULTY PREVIEW
 */
function SampleFacultyPreview() {
  const sampleData = [
    {
      name: "Dr. Karthika Natarajan",
      designation: "Associate Professor Grade 1",
      department: "School of Computer Science and Engineering (SCOPE)",
      researchArea: "Artificial Intelligence, Machine Learning, Deep Learning"
    },
    {
      name: "Dr. Jagadish Chandra Mudiganti",
      designation: "Professor",
      department: "School of Electronics Engineering (SENSE)", 
      researchArea: "IoT, Embedded Systems, Signal Processing"
    }
  ]

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {sampleData.map((faculty, index) => (
        <div key={index} className="border rounded-lg p-4 bg-gray-50">
          <div className="h-32 bg-gray-200 rounded mb-3 flex items-center justify-center">
            <span className="text-gray-500">👤 Faculty Photo</span>
          </div>
          <h4 className="font-medium text-gray-800">{faculty.name}</h4>
          <p className="text-sm text-gray-600 mb-1">{faculty.designation}</p>
          <p className="text-sm text-blue-600 mb-2">{faculty.department}</p>
          <p className="text-xs text-gray-500">{faculty.researchArea}</p>
        </div>
      ))}
    </div>
  )
}

export default SetupHelper