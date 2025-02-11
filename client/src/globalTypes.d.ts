export interface User {
  id: number;
  username: string;
  city: string;
  country: string;
}

export interface Project {
  id: number;
  leader_id: number;
  project_name: string;
  description: string;
}

interface Member {
  id: number;
  username: string;
}

interface Stem {
  id: number;
  stem_name: string;
  url: string;
  project_id: number;
  api_id: string;
}
