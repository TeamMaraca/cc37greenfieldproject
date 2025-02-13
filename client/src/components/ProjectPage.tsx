import React, { useEffect, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowsRotate } from "@fortawesome/free-solid-svg-icons";
import { faCrown } from "@fortawesome/free-solid-svg-icons";
import { faTrashCan } from "@fortawesome/free-regular-svg-icons";
import { faDownload } from "@fortawesome/free-solid-svg-icons/faDownload";
import { faUpload } from "@fortawesome/free-solid-svg-icons/faUpload";
import "./ProjectPage.css";
import { Project, User, Stem, Member } from "../globalTypes";
import { deleteData, getData } from "../helpers/fetchHelpers";

type ProjectPageProps = {
  project: Project;
  loggedInUser: User | null;
};

const ProjectPage = ({ project, loggedInUser }: ProjectPageProps) => {
  // changes database target URL depending on current environment
  const url: string =
    import.meta.env.MODE === "development" ? "http://localhost:8080/" : "/";

  const [members, setMembers] = useState<Member[]>([]);
  const [stems, setStems] = useState<Stem[]>([]);
  const [message, setMessage] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  // checks to see if the logged in user can join this project
  const canJoin = () => {
    if (loggedInUser) {
      if (members.some((member) => member.id === loggedInUser.id)) {
        return false;
      } else {
        return true;
      }
    }
    return false;
  };

  // checks to see if the logged in user can contribute to this project
  const isMember = () => {
    if (loggedInUser) {
      if (members.some((member) => member.id === loggedInUser.id)) {
        return true;
      } else {
        return false;
      }
    }
    return false;
  };

  useEffect(() => {
    // Fetch members and stems for the project
    const fetchProjectData = async () => {
      try {
        const membersResponse = await fetch(
          `${url}api/project/${project.id}/member`
        );
        const membersData = await membersResponse.json();
        setMembers(membersData);

        const stemsResponse = await fetch(
          `${url}api/project/${project.id}/stem`
        );
        const stemsData = await stemsResponse.json();
        setStems(stemsData);
      } catch (error) {
        console.error("Error fetching project data:", error);
      }
    };

    fetchProjectData();
  }, [project.id]);

  useEffect(() => {}, [members]);

  const handleFileUpload = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const fileInput = document.getElementById("fileInput") as HTMLInputElement;
    const file = fileInput.files?.[0];

    if (!file) {
      setMessage("No file selected");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);
    formData.append("project_id", project.id.toString());

    try {
      const response = await fetch(`${url}api/user/upload`, {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      const data = await response.json();

      if (response.ok) {
        setMessage("File uploaded successfully");
        setStems((prevStems) => [...prevStems, data.stem]);
      } else {
        setMessage(data.message);
        console.error(message);
      }
    } catch (error) {
      console.error("Error:", error);
      setMessage("An error occurred");
    }
  };

  const addUserToProject = async () => {
    if (!loggedInUser) {
      // if the user is not logged in, prevent joining a project
      setError("You must be logged in to join a project");
    }

    try {
      // get the current userID
      if (loggedInUser) {
        await fetch(`${url}api/project/${loggedInUser.id}/${project.id}`, {
          method: "POST",
        });
      }
      const membersResponse = await fetch(
        `${url}api/project/${project.id}/member`
      );
      const membersData = await membersResponse.json();
      setMembers(membersData);
    } catch (err) {
      setError("User could not be added to project.");
      console.error(error, err);
    }
  };

  const refreshProject = async () => {
    const membersResponse = await fetch(
      `${url}api/project/${project.id}/member`
    );
    const membersData = await membersResponse.json();
    setMembers(membersData);

    const stemsResponse = await fetch(`${url}api/project/${project.id}/stem`);
    const stemsData = await stemsResponse.json();
    setStems(stemsData);
  };

  return (
    <div className="project-page">
      <div className="project-header">
        <h2>{project.project_name}</h2>
        <button className="icon-btn" onClick={refreshProject}>
          <FontAwesomeIcon icon={faArrowsRotate} />
        </button>
      </div>
      <p>{project.description}</p>

      <div>
        <h3>Members</h3>
        <ul>
          {members.map((member) => (
            <li key={member.id}>
              <div className="member">
                <p>{member.username}</p>
                {member.id === project.leader_id && (
                  <span className="crown">
                    <FontAwesomeIcon icon={faCrown} />
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <h3>Stems</h3>
        <ul>
          {stems.length > 0 ? (
            stems.map((stem) => (
              <li key={stem.id}>
                <div className="stem">
                  <p className="stem-name">{stem.stem_name}</p>
                  <div className="controls">
                    <a href={stem.url} download>
                      <button className="icon-btn">
                        <FontAwesomeIcon icon={faDownload} />
                      </button>
                    </a>
                    {isMember() && (
                      <button
                        className="icon-btn"
                        onClick={async () => {
                          await deleteData(url, `api/stem`, stem.id);
                          const result = await getData(
                            url,
                            `api/project/${project.id}/stem`
                          );
                          setStems(result);
                        }}
                      >
                        <FontAwesomeIcon icon={faTrashCan} />
                      </button>
                    )}
                  </div>
                </div>
                <iframe
                  src={`https://drive.google.com/file/d/${stem.api_id}/preview`}
                ></iframe>
              </li>
            ))
          ) : (
            <p>No stems yet 🤯! Get to work!</p>
          )}
        </ul>
      </div>

      {isMember() && (
        <form id="uploadForm" onSubmit={handleFileUpload}>
          {/* handles uploading a stem to the current project */}
          <input type="file" id="fileInput" name="file" required />
          <button className="action-call upload-btn" type="submit">
            <FontAwesomeIcon icon={faUpload} />
          </button>
        </form>
      )}

      {canJoin() && (
        <button className="join-btn" type="button" onClick={addUserToProject}>
          Join This Project
        </button>
      )}
    </div>
  );
};

export default ProjectPage;
