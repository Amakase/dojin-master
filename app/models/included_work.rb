class IncludedWork < ApplicationRecord
  belongs_to :work

  validates :title, presence: true, uniqueness: { scope: :work }
end
