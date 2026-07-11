import { Route, Routes } from "react-router-dom";
import Signup from "./pages/Signup";
import Login from "./pages/Login";
import LandingPage from "./pages/Landing";
import Dashboard from "./pages/Dashboard";
import Assets from "./pages/Assets";
import NewAsset from "./pages/NewAsset";
import Issues from "./pages/Issues";
import IssueDetails from "./pages/IssueDetails";
import ReportIssue from "./pages/ReportIssue";
import './App.css'                                           



function App() {
  return (
    <>
      <Routes>
      <Route path="*" element="change link"/>
        <Route path="/" element={<LandingPage />}/>
        <Route path="/signup" element={<Signup />}/>
        <Route path="/login" element={<Login />}/>
        <Route path="/dashboard" element={<Dashboard/>}/>
        <Route path="/assets" element={<Assets />}/>
        <Route path="/assets/new" element={<NewAsset />}/>
        <Route path="/issues" element={<Issues />}/>
        <Route path="/issues/:id" element={<IssueDetails />}/>
        <Route path="/report" element={<ReportIssue />}/>
      </Routes>
    </>
  )
}

export default App;
