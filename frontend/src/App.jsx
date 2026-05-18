import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './lib/AuthContext';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Upload from './pages/Upload';
import VideoDetail from './pages/VideoDetail';
import Search from './pages/Search';
import GoLive from './pages/GoLive';
import LiveWatch from './pages/LiveWatch';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <div className="min-h-screen bg-white">
          <Navbar />
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/upload" element={<Upload />} />
            <Route path="/videos/:id" element={<VideoDetail />} />
            <Route path="/search" element={<Search />} />
            <Route path="/go-live" element={<GoLive />} />
            <Route path="/live/:id" element={<LiveWatch />} />
          </Routes>
        </div>
      </AuthProvider>
    </BrowserRouter>
  );
}
