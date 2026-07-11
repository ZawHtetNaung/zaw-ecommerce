<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;

class UserController extends Controller
{
    public function index()
    {
        return response()->json(
            User::query()
                ->select(['id', 'name', 'email', 'created_at'])
                ->latest()
                ->get()
        );
    }
}
