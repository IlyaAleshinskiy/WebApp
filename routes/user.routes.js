const Router = require('express')
const router = new Router()
const UserController = require(`D:\\WebStorm\\Files\\controller\\user.controller.js`)

// Курсовая
router.post("/booking", UserController.newApplication)
router.post("/register", UserController.registerUser)
router.post("/client_data", UserController.clientData)
router.post("/login", UserController.loginUser)
router.post("/post_services", UserController.postServices)
router.get("/client_application", UserController.clientApplication)
router.get("/type_room", UserController.typeRoomIndex)
router.get("/type_room2", UserController.typeRoomBooking)
router.get("/booking", UserController.getApplication)
router.get("/get_services", UserController.getServices)
router.put("/application", UserController.updateApplication)
router.put("/cancel_application", UserController.rejectApplication)

module.exports = router