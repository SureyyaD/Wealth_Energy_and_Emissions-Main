import { Layout as AntLayout } from "antd";
import { Routes, Route } from "react-router-dom";

// Pages
import LandingPage from "./pages/LandingPage.tsx";
import RenewableSharePage from "./pages/RenewableSharePage.tsx";
import Drought from "./pages/Drought.tsx";
import Wildfires from "./pages/Wildfires.tsx";
import CompareDashboard from "./pages/CompareDashboard.tsx";

const { Content } = AntLayout;

function App() {

    return (
        <div style={{
            display: "flex",
            flexDirection: "column",
            transition: "min-height 0.5s ease-in-out",
            minHeight: "100vh",
            backgroundColor: "#02040a" // Dark background for the entire app
        }}>
            <div style={{
                display: "flex",
                flexDirection: "column",
                flexGrow: 1,
            }}>
                {/* Override AntLayout's default gray background */}
                <AntLayout style={{ minHeight: "100vh", background: "transparent" }}>

                    <Content style={{ flex: 1, padding: 0, overflowY: "auto", background: "transparent" }}>
                        <div style={{ position: "relative" }}>
                            <Routes>

                                {/* Landing Page */}
                                <Route path="/" element={<LandingPage />} />

                                {/* Drought, Cereal and food prices page */}
                                <Route path="/usecases/1" element={<Drought />} />

                                {/* Wildfires page */}
                                <Route path="/usecases/2" element={<Wildfires />} />

                                {/* Renewable Share Page */}
                                <Route path="/usecases/3" element={<RenewableSharePage />} />

                                {/* CompareDashboard */}
                                <Route path="/compare/:theme" element={<CompareDashboard/>} />

                            </Routes>
                        </div>
                    </Content>

                </AntLayout>
            </div>
        </div>
    )
}

export default App;