Rails.application.routes.draw do
  devise_for :users
  root to: "pages#home"
  # Define your application routes per the DSL in https://guides.rubyonrails.org/routing.html

  # Reveal health status on /up that returns 200 if the app boots with no exceptions, otherwise 500.
  # Can be used by load balancers and uptime monitors to verify that the app is live.
  get "up" => "rails/health#show", as: :rails_health_check

  # Render dynamic PWA files from app/views/pwa/* (remember to link manifest in application.html.erb)
  # get "manifest" => "rails/pwa#manifest", as: :pwa_manifest
  # get "service-worker" => "rails/pwa#service_worker", as: :pwa_service_worker

  # Defines the root path route ("/")
  # root "posts#index"
  # Admin namespace: provides URL prefix (/admin/...), controller module (Admin::),
  # and named helper prefix (admin_*). Pundit is automatically skipped for all
  # controllers under this namespace via the regex in ApplicationController#skip_pundit?.
  namespace :admin do
    resources :events, only: [] do
      resource :map_editor,   only: [:show, :update]
      resource :ai_placement, only: [:create], controller: "ai_placements"
    end
  end

  resources :events, only: [:index, :show] do
    resources :favorites, only: [:index]
    resources :bookmarked_events, only: [:create, :destroy]
  end
  resources :booths, only: [:show] do
    resources :favorites, only: [:create]
  end
  resources :favorites, only: [:update]
end
