import { useState, useEffect } from "react";
import { getData } from "./helpers/fetchHelpers";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faRightToBracket } from "@fortawesome/free-solid-svg-icons";

// types
import { User, Project } from "./globalTypes";

// test test test
// components
import ProjectItem from "./components/ProjectItem";
import ProfilePage from "./components/ProfilePage";
import CreateNewProjectPage from "./components/CreateNewProjectPage";
import SignUpPage from "./components/SignUpPage";
import LogInPage from "./components/LogInPage";
import Modal from "./components/Modal";

// images
import logo from "./assets/sc_logo_regular_dark.png";

// styles
import "./App.css";

function App() {
  const url: string =
    import.meta.env.MODE === "development" ? "http://localhost:8080/" : "/"; // sets database target URL based on current environment

  //const [userData, setUserData] = useState<User[] | null>(null);

  const [projectData, setProjectData] = useState<Project[] | null>(null); // ensures that projectData is either an array of project data or null

  const [loggedInUser, setLoggedInUser] = useState<User | null>(null);
  const [currentModal, setCurrentModal] = useState<JSX.Element | null>(null);

  // check to see if the user has a valid session token on page load
  const checkIfLoggedIn = async () => {
    const result = await getData(url, "api/auth/user");

    if (
      result.message === "Unauthorized" ||
      result.message === "User not found"
    ) {
      setLoggedInUser(null);
    } else {
      setLoggedInUser(result.user);
    }
  };

  // runs when the page loads
  useEffect(() => {
    checkIfLoggedIn();

    // pulls all data from the database
    (async () => {
      //const userResult = await getData(url, 'api/user');
      //setUserData(userResult);

      const projectResult = await getData(url, "api/project");
      setProjectData(projectResult);
    })();
  }, []);

  // checks if the user is logged in when transitioning between modals
  // checks for users logging in or out
  useEffect(() => {
    checkIfLoggedIn();
    console.log(loggedInUser);
  }, [currentModal]);

  return (
    <>
      {currentModal && (
        <Modal currentModal={currentModal} setCurrentModal={setCurrentModal} />
      )}

      <header>
        <img className="logo" src={logo} alt="SoundCrowd's Logo" />
        <nav>
          <ul>
            {loggedInUser ? (
              <>
                <li>
                  <button
                    className="action-call"
                    type="button"
                    onClick={() =>
                      setCurrentModal(
                        <CreateNewProjectPage
                          loggedInUser={loggedInUser}
                          setProjectData={setProjectData}
                          setCurrentModal={setCurrentModal}
                        />
                      )
                    }
                  >
                    New Project
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() =>
                      setCurrentModal(
                        <ProfilePage
                          loggedInUser={loggedInUser}
                          setCurrentModal={setCurrentModal}
                        />
                      )
                    }
                  >
                    Profile
                  </button>
                </li>
              </>
            ) : (
              <>
                <li>
                  <button
                    className="action-call"
                    type="button"
                    onClick={() =>
                      setCurrentModal(
                        <SignUpPage
                          //setUserData={setUserData}
                          setCurrentModal={setCurrentModal}
                        />
                      )
                    }
                  >
                    Sign up
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() =>
                      setCurrentModal(
                        <LogInPage setCurrentModal={setCurrentModal} />
                      )
                    }
                  >
                    Login{" "}
                    <span className="nav-icon">
                      <FontAwesomeIcon icon={faRightToBracket} size="lg" />
                    </span>
                  </button>
                </li>
              </>
            )}
          </ul>
        </nav>
      </header>

      <main>
        {loggedInUser ? (
          <section className="user-logged-in-hero">
            <h2 className="frontpage-hero-title">
              Hello,{" "}
              <span className="user-logged-in-name">
                {loggedInUser.username}
              </span>
              <span className="frontpage-hero-title">!</span>
            </h2>
          </section>
        ) : (
          <section className="user-not-logged-in-hero">
            <h2 className="frontpage-hero-title">
              Welcome to <span className="logo-green">Sound</span>Crowd
            </h2>
            <h3 className="frontpage-hero-subtitle">
              We can't wait to hear from you
              <span className="accent-pink">.</span>
            </h3>
          </section>
        )}

        <section className="news-feed">
          <h2>Recent Projects</h2>
          <ul>
            {projectData &&
              projectData.map((project) => (
                <li key={project.id}>
                  <ProjectItem
                    project={project}
                    loggedInUser={loggedInUser}
                    setCurrentModal={setCurrentModal}
                  />
                </li>
              ))}
          </ul>
        </section>
        {/* Temporary fix to add a sapce to see the whole recent projects box ( height was added in App.css ) */}
        <footer></footer>
      </main>
    </>
  );
}

export default App;
