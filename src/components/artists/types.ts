
export interface CreateArtistForm {
  full_name: string;
  surname_first_letter?: string;
  birth_year?: number;
  death_year?: number;
  place_of_birth?: string;
  place_of_death?: string;
  nationality?: string;
  biography?: string;
  image?: FileList;
  email?: string;
}

