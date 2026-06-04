import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
//import "../styles/Dashboard.css";
import styles from '../App.module.css';
import Footer from "../components/Footer";

const Dashboard = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);

  useEffect(() => {
  const storedUser = JSON.parse(localStorage.getItem("user"));
  if (!storedUser) {
    navigate("/login");
    return;
  }
  setUser(storedUser);

  if (storedUser.experienceLevel) {
    navigate("/yazma");
  }
}, [navigate]);


  const handleChoice = async (choice) => {
    try {
      const response = await fetch("http://localhost:5000/api/set-experience", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: user._id, experienceLevel: choice }),
});


      if (response.ok) {
        const updatedUser = await response.json();
        localStorage.setItem("user", JSON.stringify(updatedUser));

        if (choice === "no-experience") {
          navigate("/yazma");
        } else {
          navigate("/yazma");
        }
      } else {
        console.error("Seviye güncellenemedi");
      }
    } catch (error) {
      console.error("Hata:", error);
    }
  };

  return (
    <div className={styles.authPage}>
      <div className={styles.container}>
        <h2 className="welcome-title">Hoş geldin! ✨</h2>
        <p className="welcome-question">Yazı yolculuğunda neredesin?</p>
        <br />

        <div className="choice-buttons">
          <button className={styles.button} onClick={() => handleChoice("no-experience")}>
            Daha önce hiç yazmadım
          </button>
          <br />
          <br />
          <button className={styles.button} onClick={() => handleChoice("some-experience")}>
            Yazı deneyimim var
          </button>
          <br />
          <br />
          <button className={styles.button} onClick={() => handleChoice("advanced")}>
            Düzenli yazıyorum
          </button>
          <br />
          <br />
          <button className={styles.button} onClick={() => handleChoice("professional")}>
            Profesyonel yazarlık yapıyorum
          </button>
        </div>
             
      </div>
      <Footer />
    </div>
    
  );
};

export default Dashboard;
