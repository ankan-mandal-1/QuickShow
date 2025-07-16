import axios from "axios";
import Movie from "../models/Movie.js";
import Show from "../models/Show.js";

export const getNowPlayingMovies = async (req, res) => {
    try {
        const response = await axios.get('https://api.themoviedb.org/3/movie/now_playing?language=en-US&page=1', {
            headers: {
                Authorization: `Bearer ${process.env.TMDB_API_KEY}`,
                "Content-Type": 'application/json'
            },
            timeout: 5000, // set timeout in case of hanging
        });

        const movies = response.data?.results || [];
        res.status(200).json({ success: true, movies });

    } catch (error) {
        console.error('TMDB API Error:', error.message);

        // Specific ECONNRESET handling
        if (error.code === 'ECONNRESET') {
            return res.status(502).json({
                success: false,
                message: 'Connection to TMDB was reset. Try again later.'
            });
        }

        // Axios errors with response (non-200 status)
        if (error.response) {
            return res.status(error.response.status).json({
                success: false,
                message: error.response.statusText,
                status: error.response.status,
                data: error.response.data
            });
        }

        // Fallback generic error
        res.status(500).json({
            success: false,
            message: 'An unexpected error occurred',
            error: error.message
        });
    }
};

// API to add a new show to the database
export const addShow = async (req, res) => {
    try {
        const {movieId, showsInput, showPrice} = req.body

        let movie = await Movie.findById(movieId)

        if(!movie){
            // Fetch movie details and credit from TMDB API
            const [movieDetailsResponse, movieCreditsResponse] = await Promise.all([
                axios.get(`https://api.themoviedb.org/3/movie/${movieId}`, {
                    headers: {
                        Authorization: `Bearer ${process.env.TMDB_API_KEY}`
                    }
                }),
                axios.get(`https://api.themoviedb.org/3/movie/${movieId}/credits`, {
                        headers: {
                            Authorization: `Bearer ${process.env.TMDB_API_KEY}`,
                        }
                    })
            ]);

            const movieApiData = movieDetailsResponse.data;
            const movieCreditsData = movieCreditsResponse.data 

            const movieDetails = {
                _id: movieId,
                title: movieApiData.title,
                overview: movieApiData.overview,
                poster_path: movieApiData.poster_path,
                backdrop_path: movieApiData.backdrop_path,
                genres: movieApiData.genres,
                casts: movieCreditsData.casts,
                release_date: movieApiData.release_date,
                original_language: movieApiData.original_language,
                tagline: movieApiData.tagline || "",
                vote_average: movieApiData.vote_average,
                runtime: movieApiData.runtime
            }

            // Add Movie to database
            movie = await Movie.create(movieDetails);
        }

        const showsToCreate = [];
        showsInput.forEach(show => {
            const showDate = show.date;
            show.time.forEach((time) => {
                const dateTimeString = `${showDate}T${time}`;
                showsToCreate.push({
                    movie: movieId,
                    showDateTime: new Date(dateTimeString),
                    showPrice,
                    occupiedSeats: {}
                })
            })
        })

        if(showsToCreate.length > 0){
            await Show.insertMany(showsToCreate)
        }

        res.json({success: true, message: 'Show Added successfully.'})

    } catch (error) {
        console.log(error);
        res.json({success: false, message: error.message})
    }
}

// API to get all shows from the database

export const getShows = async (req, res) => {
    try {
        const shows = await Show.find({showDateTime: {$gte: new Date()}}).populate('movie').sort({ showDateTime: 1});

        // Filter unique shows
        const uniqueShows = new Set(shows.map(show => show.movie))

        res.json({success: true, shows: Array.from(uniqueShows)})
    } catch (error) {
        console.log(error)
        res.json({success: false, message: error.message});
    }
}
//API to get a single show from the database
export const getShow = async (req, res) => {
    try {
        const {movieId} = req.params;
        // Get all upcoming shows for the movie

        const shows = await Show.find({movie: movieId, showDateTime: {$gte: new Date()}})

        const movie = await Movie.findById(movieId);
        const dateTime = {};

        shows.forEach((show) => {
            const date = show.showDateTime.toISOString().split("T")[0];
            if(!dateTime[date]){
                dateTime[date] = []
            }
            dateTime[date].push({ time: show.showDateTime, showId: show._id})
        })
        res.json({success: true, movie, dateTime})
    } catch (error) {
        console.log(error)
        res.json({success: false, message: error.message});
    }
}