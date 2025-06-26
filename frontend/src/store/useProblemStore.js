import {create} from 'zustand';
import {axiosInstance} from '../lib/axios';
import toast from 'react-hot-toast';



export const useProblemStore = create((set)=>({
    problems:[],
    problem:null,
    solvedProblems:[],
    isProblemsLoading:false,
    isProblemLoading:false,


    getAllProblems:async()=>{
        try {
            set({isProblemLoading:true})

            const res = await axiosInstance.get("/problems/get-all-problems");

            set({problems:res.data.problems})

        } catch (error) {
            console.log("Error in getting all problems",error);
            toast.error("Error in getting all problems")
        }
        finally{
            set({isProblemLoading:false})
        }
    },

    getProblemById:async(id)=>{
        try {
            set({isProblemLoading:true})

            const res = await axiosInstance.get(`/problems/get-problem/${id}`)

            set({problem:res.data.problem})
            toast.success(res.data.message)


        } catch (error) {
            console.log("Error fetching problem",error);
            toast.error("Error fetching problem")
        }
        finally{
            set({isProblemLoading:false})
        }
    },

    getSolvedProblemByUser:async() =>{
        try {
            const res = await axiosInstance.get("/problems/get-solved-problem")
            set({solvedProblems:res.data.problems})
            
        } catch (error) {
            console.log("Error in getting solved problems",error);
            toast.error("Error in getting solved problems")
        }
    }

}))