import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faRightToBracket } from "@fortawesome/free-solid-svg-icons";
import { getData } from "../helpers/fetchHelpers";
import { User, Project } from "../globalTypes";
import "./ProfilePage.css";
import avatar from "../assets/avatar.png";
import { useState, useEffect } from "react";

type ProfilePageProps = {
  loggedInUser: User | null;
  setCurrentModal: React.Dispatch<React.SetStateAction<JSX.Element | null>>;
};

const ProfilePage = ({ loggedInUser, setCurrentModal }: ProfilePageProps) => {
  const [isVisible, setIsVisible] = useState<boolean>(false);
  const [projectContributions, setProjectContribution] = useState<
    Project[] | null
  >(null);

  // changes database target URL depending on current environment
  const url: string =
    import.meta.env.MODE === "development" ? "http://localhost:8080/" : "/";

  // sends a fetch request to the backend to get all projects the logged in user is a part of
  const handleGetAllUserProjectContributions = async () => {
    // if LoggedInUser is null , don't fetch
    if (!loggedInUser) return;

    // didn't want to mess with the helper fetcher functions,
    // since I would have to refactor it to accept my request
    try {
      const contributedProjectsResponse = await fetch(
        `${url}api/project/${loggedInUser.id}/projects`
      );

      const contributedProjects = await contributedProjectsResponse.json();
      console.log(contributedProjects); // to be deleted
      setProjectContribution(contributedProjects);
    } catch (error) {
      console.error("Error fetching projects:", error);
    }
  };

  // when profile is initialized, call handler
  useEffect(() => {
    handleGetAllUserProjectContributions();
  }, []);

  return (
    <div className='profile-page'>
      <h2>PROFILE</h2>
      {loggedInUser && (
        <>
          <img className='avatar' src={avatar} alt='Your profile picture' />
          <button>Upload Profile Pic</button>
          <input type='file' />
          <label>USERNAME</label>
          <p>{loggedInUser.username}</p>
          {loggedInUser.city && (
            <>
              <label>CITY</label>
              <p>{loggedInUser.city}</p>
            </>
          )}
          <label>COUNTRY</label>
          <p>{loggedInUser.country}</p>
          {/* 
          add project contribution here. 
          Drop down list of projects that the user is a part of 
          */}
        </>
      )}

      <button
        type='button'
        onClick={async () => {
          await getData(url, "api/auth/logout");
          setCurrentModal(null);
        }}
      >
        Log Out{" "}
        <span className='nav-icon'>
          <FontAwesomeIcon
            icon={faRightToBracket}
            size='lg'
            flip='horizontal'
          />
        </span>
      </button>
    </div>
  );
};

export default ProfilePage;
