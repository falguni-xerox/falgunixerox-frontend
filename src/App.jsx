import { Routes, Route, Link } from "react-router-dom";
import UploadPage from "./UploadPage";
import Admin from "./Admin";

function HomePage() {
  return (
    <div
      style={{
        textAlign: "center",
        padding: "50px",
        maxWidth: "700px",
        margin: "0 auto",
      }}
    >
      <h1>🖨️ Falguni Xerox</h1>

      <p>QR Based Self Service Printing System</p>

      <div style={{ marginTop: "40px" }}>
        <Link to="/upload">
          <button
            style={{
              width: "260px",
              padding: "15px",
              fontSize: "18px",
              background: "#0a8f08",
              color: "#fff",
              border: "none",
              borderRadius: "8px",
              cursor: "pointer",
              marginBottom: "15px",
            }}
          >
            📄 Upload & Print
          </button>
        </Link>

        <br />

        <Link to="/admin">
          <button
            style={{
              width: "260px",
              padding: "15px",
              fontSize: "18px",
              background: "#ff9800",
              color: "#fff",
              border: "none",
              borderRadius: "8px",
              cursor: "pointer",
            }}
          >
            🛠 Admin Panel
          </button>
        </Link>
      </div>

      <div
        style={{
          marginTop: "40px",
          color: "#666",
          fontSize: "14px",
        }}
      >
        Powered by Falguni Xerox
      </div>
    </div>
  );
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />

      <Route path="/upload" element={<UploadPage />} />

      <Route path="/admin" element={<Admin />} />

      <Route path="*" element={<HomePage />} />
    </Routes>
  );
}

export default App;