import { Routes, Route } from 'react-router-dom'
import UploadPage from './UploadPage'

function App() {
  return (
      <Routes>
        <Route path="/upload" element={<UploadPage />} />
        <Route path="/" element={<div style={{textAlign:'center', padding:'50px'}}><h2>Home Page</h2></div>} />
      </Routes>
  )
}
export default App