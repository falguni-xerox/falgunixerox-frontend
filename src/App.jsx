import { BrowserRouter, Routes, Route } from 'react-router-dom'
import UploadPage from './UploadPage'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/upload" element={<UploadPage />} />
        <Route path="/" element={<div style={{textAlign:'center', padding:'50px'}}><h2>Home Page</h2></div>} />
      </Routes>
    </BrowserRouter>
  )
}
export default App