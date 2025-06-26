import e from "express";
import { db } from "../libs/db.js";

export const createPlaylist = async (req,res) =>{
    try {
        const {name, description} = req.body;
        const userId = req.user.id;
        const playlist  = await db.playlist.create({
            data:{
                name,
                description,
                userId
            }
        })

        //Add vaildation  already exist or not

        if(!playlist){
            return res.status(400).json({
                success: false,
                message: "Playlist not created"
            })
        }

        res.status(200).json({
            success: true,
            message: "Playlist created successfully",
            playlist
        })

    } catch (error) {
        console.log(error);
        res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message
        })
        
    }
}


export const getAllListDetails = async (req,res) =>{
    try {
        const playlists = await db.playlist.findMany({
            where:{
                userId:req.user.id
            },
            include:{
                problems:{
                    include:{
                        problem:true
                    }
                }
            }
        })

        res.status(200).json({
            success: true,
            message: "Playlists fetched successfully",
            playlists
        })
    } catch (error) {
        console.log("Error fetching playlists",error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch playlists",
        })
        
    }
}


export const getPlayListDetails = async (req,res) =>{
    const {playlistId} = req.params;

    try {
        const playlist = await db.playlist.findUnique({
            where:{
                id:playlistId,
                userId:req.user.id
            },
            include:{
                problems:{
                    include:{
                        problem:true
                    }
                }
            }
        })

        if(!playlist){
            return res.status(404).json({
                success: false,
                error: "Playlist not found",
                message: "Playlist not found"
            })

        res.status(200).json({
                success: true,
                message: "Playlist fetched successfully",
                playlist
            })
        }
    } catch (error) {
        console.log("Error fetching playlist",error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch playlist",
            error: error.message
        })
        
    }

}

export const  addProblemToPlaylist = async (req,res) =>{
    const {playlistId} = req.params;
    const {problemIds} = req.body;

    try {
        if(!Array.isArray(problemIds)|| problemIds.length === 0)
        {
            return res.status(400).json({
                success: false,
                message: "Invalid or missing problemsId",
                error: "Invalid or missing problemsId"
            })
        }

        //create records for each problem in the plaulist
        const problemsInPlaylist = await db.problemInPlaylist.createMany({
            data:problemIds.map((problemId)=>({
                playlistId,
                problemId
            }))
        })

        //check if problem already exists in the playlist
        const existingProblemInPlaylist = await db.problemInPlaylist.findMany({
            where:{
                playlistId,
                problemId:{
                    in:problemIds
                }  
            }
        })

        if(existingProblemInPlaylist.length > 0){
            return res.status(400).json({
                success: false,
                message: "Problems already exist in playlist",
                error: "Problems already exist in playlist"
            })
        }

        res.status(201).json({
            success: true,
            message: "Problems added to playlist successfully",
            problemsInPlaylist
        })

    } catch (error) {
        console.log("Error adding problems to playlist",error);
        res.status(500).json({
            success: false,
            message: "Failed to add problems to playlist",
            error: "Internal server error"
        })
    }
}

export const deletePlaylist = async (req,res)=> {
    const {playlistId} = req.params;

    try {
        const deletedPlaylist = await db.playlist.delete({
            where:{
                id:playlistId,
            }
        })

        res.status(200).json({
            success: true,
            message: "Playlist deleted successfully",
            deletedPlaylist
        })
    } catch (error) {
        console.log("Error deleting playlist",error);
        res.status(500).json({
            success: false,
            message: "Failed to delete playlist",
            error: "Internal server error"
        })
    }
}

export const removeProblemFromPlaylist = async (req,res) => {
    const {playlistId} = req.params;
    const {problemIds} = req.body;

    try {
        if(!Array.isArray(problemIds) || problemIds.length === 0)
        {
            return res.status(400).json({
                success: false,
                message: "Invalid or missing problemsId",
                error: "Invalid or missing problemsId"
            })
        }

        const deletedProblem = await db.problemInPlaylist.deleteMany({
            where:{
                playlistId,
                problemId:{
                    in:problemIds
                }
            }
        })

    } catch (error) {
        console.log("Error removing problems from playlist",error);
        res.status(500).json({
            success: false,
            message: "Failed to remove problems from playlist",
            error: "Internal server error"
        }) 
    }
}


